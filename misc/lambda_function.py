"""
AWS Lambda function for generating medical reports using Amazon Bedrock and storing in S3.

This function:
1. Receives experiment measurements, doctor username, and patient name via API Gateway
2. Sends data to Amazon Bedrock (DeepSeek) for analysis
3. Generates a formatted PDF report
4. Saves to S3 bucket
5. Returns pre-signed download URL

Dependencies (add to Lambda layer):
- boto3 (included in Lambda runtime)
- reportlab (for PDF generation - NO PIL required)
"""

import json
import boto3
import os
import base64
from datetime import datetime, timedelta
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

# Try to import svglib for SVG logo support (optional)
try:
    from svglib.svglib import svg2rlg
    from reportlab.graphics import renderPDF
    SVG_SUPPORT = True
except ImportError:
    SVG_SUPPORT = False

# AWS clients
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
s3_client = boto3.client('s3')
polly_client = boto3.client('polly', region_name='us-east-1')  # Neural voices supported in us-east-1

# Configuration
S3_BUCKET = os.environ.get('S3_BUCKET', 'daignostics-reports')
S3_PREFIX = 'reports/'
BEDROCK_MODEL_ID = 'us.anthropic.claude-3-haiku-20240307-v1:0'  # Claude 3 Haiku inference profile

# Logo SVG data for PDF (embedded as drawing if svglib is available)
LOGO_SVG_DATA = '''<svg xmlns="http://www.w3.org/2000/svg" width="175" height="40" viewBox="0 0 175 40" fill="none"><path d="M18.5544 34.2482H22.4778L30.0794 13.5686H26.156L18.5544 34.2482Z" fill="#E21E3A"></path><path d="M26.2377 0H30.0794V11.6885H26.2377V0Z" fill="#E21E3A"></path><path d="M43.3209 34.2482H39.4793L31.8777 13.5686H35.8011L43.3209 34.2482Z" fill="#E21E3A"></path><path d="M35.7193 0H31.8777V11.6885H35.7193V0Z" fill="#E21E3A"></path><path d="M47.98 34.2482H51.8216V13.5686H47.98V34.2482Z" fill="#E21E3A"></path><path d="M13.405 13.5686H15.2032V26.6466C15.2032 28.1179 14.7945 29.4257 13.9771 30.7335C13.8136 31.0604 13.5684 31.3056 13.2415 31.6326C12.8328 32.0413 12.5876 32.2865 12.4241 32.3682C12.0154 32.6952 11.6885 32.9404 11.2798 33.1856C10.1355 33.8395 8.90939 34.1665 7.60159 34.1665C6.13031 34.1665 4.74078 33.7578 3.43298 32.9404C3.10603 32.6952 2.77908 32.45 2.37039 32.123C2.04344 31.7961 1.79823 31.5509 1.71649 31.3874C1.38954 30.9787 1.14433 30.6517 0.899113 30.2431C0.32695 29.0987 0 27.9544 0 26.6466V26.5649C0 25.0119 0.490425 23.6223 1.38954 22.2328C1.55301 21.9876 1.79823 21.6606 2.12518 21.3337C2.53386 20.925 2.86081 20.6798 3.10603 20.5163C3.35124 20.2711 3.67819 20.1076 4.00514 19.9441C5.14946 19.2902 6.37553 19.045 7.60159 19.045H7.68333C9.23634 19.045 10.7076 19.5354 12.0154 20.4346C12.2606 20.598 12.5058 20.7615 12.6693 21.0067V23.8675C12.5058 23.5406 12.2606 23.1319 11.8519 22.7232C11.525 22.3145 11.198 22.151 11.0346 21.9876C9.97198 21.2519 8.90939 20.925 7.68333 20.925C6.29379 20.925 4.98599 21.4154 3.9234 22.3963C3.51471 22.8049 3.35124 22.9684 3.2695 23.0502C2.37039 24.1127 1.9617 25.3388 1.9617 26.7283C1.9617 28.1179 2.45213 29.4257 3.43298 30.57C3.84166 30.9787 4.00514 31.1422 4.08688 31.2239C5.14946 32.123 6.37553 32.5317 7.76506 32.5317C8.99113 32.5317 10.2172 32.123 11.2798 31.3874C11.4433 31.2239 11.6885 30.9787 12.0972 30.6517C12.3424 30.4065 12.4241 30.2431 12.4241 30.2431C12.6693 29.8344 12.9145 29.5892 12.9963 29.3439C13.405 28.5266 13.5684 27.7092 13.5684 26.8918L13.405 13.5686Z" fill="#303030"></path><path d="M159.061 30.161C158.898 30.4062 158.571 30.7331 158.162 31.0601C157.099 31.8775 155.873 32.3679 154.566 32.3679C153.176 32.3679 151.95 31.9592 150.887 31.0601C150.806 31.0601 150.561 30.8149 150.234 30.4062C149.253 29.2619 148.844 28.0358 148.844 26.6463C148.844 25.3385 149.253 24.1941 149.988 23.1316C150.07 22.9681 150.315 22.7229 150.724 22.3959C151.868 21.4151 153.176 20.9246 154.566 20.9246C155.22 20.9246 155.955 21.0064 156.609 21.2516C157.59 21.6603 158.407 22.2324 159.061 23.0498H161.186C161.105 22.9681 161.105 22.8863 161.105 22.8046C160.941 22.5594 160.778 22.2324 160.451 21.9055C160.369 21.742 160.124 21.4968 159.797 21.1699C159.47 20.8429 159.143 20.5977 158.898 20.4342C157.59 19.5351 156.119 19.0447 154.647 19.0447H154.484C153.176 19.0447 151.868 19.3716 150.642 20.1073C150.397 20.2707 150.07 20.516 149.661 20.8429C149.498 21.0064 149.253 21.2516 148.926 21.4968C148.599 21.8238 148.354 22.1507 148.19 22.4777C147.373 23.7855 146.964 25.0933 146.964 26.5645V26.6463C146.964 28.1175 147.373 29.4253 148.19 30.7331C148.354 30.9784 148.517 31.2236 148.762 31.5505C148.844 31.714 149.089 31.9592 149.416 32.2862C149.825 32.6131 150.152 32.8583 150.479 33.1035C151.787 33.8392 153.094 34.2479 154.484 34.2479H154.566C155.465 34.2479 156.364 34.0844 157.181 33.7574C158.734 33.1035 160.042 32.1227 160.941 30.6514C161.023 30.4879 161.105 30.4062 161.186 30.2427H159.061V30.161Z" fill="#303030"></path><path d="M64.0004 19.0447C65.7169 19.0447 67.1882 19.5351 68.5777 20.5977C68.823 20.7612 69.0682 21.0064 69.3951 21.3333C69.7221 21.742 70.049 22.069 70.2125 22.3142C71.1116 23.622 71.602 25.0933 71.602 26.6463V32.1227C71.602 33.594 71.1933 34.9018 70.376 36.2096C70.1308 36.5365 69.8855 36.9452 69.4769 37.2721C69.0682 37.6808 68.7412 37.926 68.5777 38.0895C68.2508 38.3347 67.9238 38.5799 67.6786 38.6617C66.5343 39.3156 65.3082 39.6425 64.0004 39.6425H63.9187C62.4474 39.6425 61.1396 39.2338 59.8318 38.4165C59.5866 38.253 59.1779 38.0078 58.851 37.5991C58.3606 37.1904 58.1153 36.8635 58.0336 36.7C57.7884 36.4548 57.6249 36.2096 57.5432 35.9643C57.4614 35.8009 57.3797 35.7191 57.3797 35.7191H59.5049C59.6684 35.8826 59.8318 36.0461 59.9953 36.2096C60.404 36.5365 60.7309 36.8635 60.9762 36.9452C61.957 37.5174 62.9379 37.8443 64.0822 37.8443C65.39 37.8443 66.616 37.4356 67.6786 36.5365C68.0873 36.2096 68.4143 35.8826 68.5777 35.6374C68.9047 35.3104 69.0682 34.9018 69.2316 34.5748C69.5586 33.7574 69.8038 32.9401 69.8038 32.2044V26.5645C69.8038 25.5837 69.5586 24.6846 68.9864 23.7037C68.823 23.4585 68.5777 23.1316 68.3325 22.8046C68.0056 22.4777 67.7604 22.2324 67.5969 22.1507C67.2699 21.9055 66.943 21.6603 66.6978 21.5785C65.7987 21.0881 64.9813 20.9246 64.0822 20.9246H63.9187C62.9379 20.9246 62.0387 21.1699 61.0579 21.742C60.8127 21.9055 60.4857 22.069 60.2405 22.3142C59.9136 22.6411 59.6684 22.8863 59.5866 22.9681C59.2597 23.3768 59.0145 23.7037 58.9327 24.0307C58.524 24.848 58.2788 25.7472 58.2788 26.5645V26.728C58.2788 27.7089 58.524 28.608 59.0962 29.5888C59.8318 30.7331 60.8127 31.5505 62.0387 32.0409C62.6926 32.2862 63.3465 32.3679 64.0004 32.3679H64.0822C65.39 32.3679 66.616 31.9592 67.7604 31.0601C68.1691 30.7331 68.4143 30.4062 68.5777 30.2427C68.823 29.9158 68.9864 29.5888 69.0682 29.4253V32.2044C69.0682 32.2044 69.0682 32.2862 68.9864 32.3679C68.7412 32.6131 68.4143 32.8583 68.1691 33.0218C66.943 33.8392 65.5535 34.2479 64.0822 34.2479H64.0004C62.6109 34.2479 61.3031 33.8392 59.9953 33.1035C58.524 32.2044 57.5432 30.8966 56.971 29.3436C56.6441 28.4445 56.4806 27.6271 56.4806 26.728V26.6463C56.4806 25.175 56.8893 23.8672 57.7067 22.5594C57.8701 22.2324 58.1153 21.9872 58.4423 21.6603C58.7692 21.2516 59.0962 21.0064 59.1779 20.9246C59.5866 20.5977 59.9136 20.3525 60.3223 20.1073C61.4666 19.3716 62.6926 19.0447 64.0004 19.0447Z" fill="#303030"></path><path d="M82.3914 19.3716C83.7809 19.3716 84.9252 19.7803 86.0696 20.5976C86.233 20.6794 86.3965 20.8429 86.56 21.0063C86.9687 21.3333 87.1322 21.5785 87.2139 21.6602C87.3774 21.8237 87.4591 21.9872 87.6226 22.2324C88.2765 23.295 88.6034 24.3576 88.6034 25.5019V33.7574H86.8869V25.5836C86.8869 24.4393 86.4783 23.4585 85.7426 22.6411C85.4157 22.3141 85.1705 22.0689 85.007 21.9872C84.2713 21.4968 83.3722 21.1698 82.4731 21.1698C81.4105 21.1698 80.5114 21.4968 79.694 22.1507C79.3671 22.3959 79.1219 22.6411 79.0401 22.8046C78.7949 23.1315 78.6315 23.3767 78.468 23.7037C78.2228 24.2758 78.0593 24.9297 78.0593 25.5019V33.8391H76.3428V25.5019C76.3428 24.1941 76.7515 22.8863 77.5689 21.742C77.7323 21.5785 77.8958 21.3333 78.0593 21.1698C78.468 20.7611 78.7949 20.5159 78.9584 20.4342C80.021 19.6985 81.1653 19.3716 82.3914 19.3716Z" fill="#303030"></path><path d="M100.701 19.0447C102.335 19.0447 103.725 19.5351 105.033 20.4342C105.278 20.5977 105.605 20.8429 105.932 21.1699C106.259 21.4968 106.504 21.742 106.586 21.9055C106.831 22.2324 107.076 22.5594 107.24 22.8046C107.975 24.0307 108.302 25.2567 108.302 26.6463V26.728C108.302 28.1175 107.894 29.4253 107.158 30.6514C106.259 32.1227 105.033 33.1035 103.398 33.7574C102.499 34.0844 101.6 34.2479 100.782 34.2479H100.701C99.3111 34.2479 98.0033 33.8392 96.6955 33.1035C96.3685 32.9401 96.0416 32.6131 95.6329 32.2862C95.3059 31.9592 95.0607 31.714 94.979 31.5505C94.7338 31.2236 94.4886 30.9784 94.4068 30.7331C93.5894 29.4253 93.1808 28.1175 93.1808 26.6463V26.5645C93.1808 25.0933 93.5894 23.7855 94.4068 22.4777C94.5703 22.1507 94.8972 21.8238 95.1425 21.4968C95.4694 21.1699 95.6329 20.9246 95.8781 20.8429C96.2868 20.516 96.6137 20.2707 96.8589 20.1073C98.085 19.3716 99.3928 19.0447 100.701 19.0447ZM94.979 26.5645C94.979 27.9541 95.4694 29.2619 96.3685 30.3245C96.6955 30.7331 96.9407 30.8966 97.0224 30.9784C98.085 31.8775 99.3111 32.2862 100.701 32.2862C102.008 32.2862 103.234 31.8775 104.297 30.9784C104.706 30.6514 105.033 30.3245 105.196 30.0792C105.523 29.6706 105.687 29.3436 105.85 28.9349C106.177 28.1175 106.422 27.3002 106.422 26.5645V26.4011C106.422 25.4202 106.177 24.5211 105.605 23.5402C104.951 22.3959 103.97 21.5785 102.662 21.0881C102.008 20.8429 101.355 20.7612 100.619 20.7612C99.1476 20.7612 97.8398 21.2516 96.7772 22.2324C96.4503 22.5594 96.205 22.8046 96.0416 22.9681C95.3877 24.1941 94.979 25.3385 94.979 26.5645Z" fill="#303030"></path><path d="M117.62 19.0447C118.601 19.0447 119.419 19.2899 120.236 19.8621C120.563 20.189 120.89 20.516 121.053 20.6794C121.544 21.4151 121.871 22.1507 121.952 22.9681L120.236 22.8863C120.236 22.8863 120.154 22.7229 120.072 22.5594C119.909 22.1507 119.827 21.9872 119.664 21.8238C119.419 21.4151 119.01 21.1699 118.519 20.9246C118.274 20.8429 117.947 20.7612 117.702 20.7612C117.048 20.7612 116.394 21.0064 115.904 21.4968C115.659 21.742 115.495 22.069 115.495 22.2324C115.413 22.4777 115.413 22.6411 115.413 22.8863C115.413 23.4585 115.659 24.0307 116.149 24.4394C116.476 24.6846 116.721 24.848 117.13 24.9298C117.212 24.9298 117.62 25.0115 118.192 25.0115C118.274 25.0115 118.438 25.0115 118.601 25.0933C118.765 25.0933 118.928 25.175 119.01 25.175C119.255 25.2567 119.582 25.3385 119.827 25.5837C120.154 25.7472 120.399 25.9106 120.481 26.0741C120.808 26.3193 121.053 26.5645 121.135 26.728C121.789 27.5454 122.116 28.5262 122.116 29.5071V29.5888C122.116 30.6514 121.789 31.5505 121.053 32.4496C120.726 32.7766 120.481 33.0218 120.399 33.1035C120.072 33.3487 119.827 33.5122 119.582 33.594C118.928 33.9209 118.274 34.0844 117.539 34.0844H117.457C116.639 34.0844 115.822 33.8392 115.005 33.3487C114.433 32.9401 113.942 32.4496 113.615 31.8775C113.206 31.3053 112.961 30.6514 112.88 30.0792H114.678C114.678 30.0792 114.759 30.3245 114.923 30.4879C115.005 30.6514 115.168 30.8149 115.25 30.9784C115.577 31.4688 115.986 31.7957 116.639 32.0409C116.966 32.1227 117.293 32.2044 117.62 32.2044C118.438 32.2044 119.092 31.8775 119.664 31.2236C120.072 30.6514 120.318 30.161 120.318 29.5888V29.4253C120.318 28.8532 120.072 28.1993 119.664 27.7089C119.419 27.4636 119.255 27.3002 119.092 27.2184C118.683 26.9732 118.356 26.8097 117.947 26.8097C117.866 26.8097 117.62 26.8097 117.212 26.728C116.885 26.728 116.639 26.6463 116.312 26.5645C115.495 26.3193 114.841 25.9106 114.269 25.2567C113.697 24.5211 113.37 23.7037 113.37 22.8046V22.7229C113.37 21.742 113.697 20.9246 114.433 20.1073C114.759 19.7803 115.005 19.5351 115.168 19.4534C115.986 19.2899 116.803 19.0447 117.62 19.0447Z" fill="#303030"></path><path d="M128.573 13.5681H130.371V19.3715H133.069V21.1697H130.371V30.5695C130.371 31.3052 130.698 31.7956 131.27 32.2043C131.597 32.3677 131.761 32.4495 132.006 32.5312C132.006 32.5312 132.497 32.613 132.742 32.6947C132.905 32.6947 132.987 32.6947 133.15 32.6947C133.314 32.6947 133.477 32.6947 133.559 32.613C133.723 32.613 134.05 32.5312 134.376 32.3677C134.54 32.286 134.622 32.286 134.785 32.2043C135.439 31.8773 135.929 31.1417 135.929 31.2234V33.0216C135.603 33.2669 135.357 33.5121 134.867 33.7573C134.458 34.0025 134.05 34.0842 133.723 34.166C133.477 34.2477 133.232 34.2477 132.905 34.2477C132.578 34.2477 132.415 34.2477 132.17 34.2477C131.843 34.2477 131.679 34.166 131.352 34.0842C130.943 34.0025 130.453 33.839 129.881 33.4303C128.982 32.6947 128.491 31.7956 128.491 30.6513V21.1697H126.693V19.3715H128.491C128.573 17.4098 128.573 15.5298 128.573 13.5681Z" fill="#303030"></path><path d="M141.488 13.4048C141.978 13.4048 142.387 13.65 142.714 14.0587C142.877 14.3039 143.041 14.6308 143.041 14.9578C143.041 15.53 142.795 15.9386 142.305 16.2656C142.06 16.4291 141.815 16.5108 141.488 16.5108C140.997 16.5108 140.507 16.2656 140.18 15.8569C140.016 15.6117 139.935 15.2847 139.935 15.0395C139.935 14.5491 140.18 14.0587 140.589 13.7317C140.915 13.4865 141.161 13.4048 141.488 13.4048ZM142.387 19.2899V34.0026H140.589V19.2899H142.387Z" fill="#303030"></path><path d="M170.504 19.0447C171.485 19.0447 172.303 19.2899 173.12 19.8621C173.447 20.189 173.774 20.516 173.937 20.6794C174.428 21.4151 174.755 22.1507 174.837 22.9681L173.12 22.8863C173.12 22.8863 173.038 22.7229 172.957 22.5594C172.793 22.1507 172.711 21.9872 172.548 21.8238C172.303 21.4151 171.894 21.1699 171.404 20.9246C171.158 20.8429 170.831 20.7612 170.586 20.7612C169.932 20.7612 169.278 21.0064 168.788 21.4968C168.543 21.742 168.379 22.069 168.379 22.2324C168.298 22.4777 168.298 22.6411 168.298 22.8863C168.298 23.4585 168.543 24.0307 169.033 24.4394C169.36 24.6846 169.605 24.848 170.014 24.9298C170.096 24.9298 170.504 25.0115 171.077 25.0115C171.158 25.0115 171.322 25.0115 171.485 25.0933C171.649 25.0933 171.812 25.175 171.894 25.175C172.139 25.2567 172.466 25.3385 172.711 25.5837C173.038 25.7472 173.284 25.9106 173.365 26.0741C173.692 26.3193 173.937 26.5645 174.019 26.728C174.673 27.5454 175 28.5262 175 29.5071V29.5888C175 30.6514 174.673 31.5505 173.937 32.4496C173.61 32.7766 173.365 33.0218 173.284 33.1035C172.957 33.3487 172.711 33.5122 172.466 33.594C171.812 33.9209 171.158 34.0844 170.423 34.0844H170.341C169.524 34.0844 168.706 33.8392 167.889 33.3487C167.317 32.9401 166.826 32.4496 166.499 31.8775C166.091 31.3053 165.845 30.6514 165.764 30.0792H167.562C167.562 30.0792 167.644 30.3245 167.807 30.4879C167.889 30.6514 168.052 30.8149 168.134 30.9784C168.461 31.4688 168.87 31.7957 169.524 32.0409C169.851 32.1227 170.178 32.2044 170.504 32.2044C171.322 32.2044 171.976 31.8775 172.548 31.2236C172.957 30.6514 173.202 30.161 173.202 29.5888V29.4253C173.202 28.8532 172.957 28.1993 172.548 27.7089C172.303 27.4636 172.139 27.3002 171.976 27.2184C171.567 26.9732 171.24 26.8097 170.831 26.8097C170.75 26.8097 170.504 26.8097 170.096 26.728C169.769 26.728 169.524 26.6463 169.197 26.5645C168.379 26.3193 167.725 25.9106 167.153 25.2567C166.581 24.5211 166.254 23.7037 166.254 22.8046V22.7229C166.254 21.742 166.581 20.9246 167.317 20.1073C167.644 19.7803 167.889 19.5351 168.052 19.4534C168.87 19.2899 169.687 19.0447 170.504 19.0447Z" fill="#303030"></path></svg>'''

def lambda_handler(event, context):
    """
    Main Lambda handler function.
    Handles both report generation and text-to-speech requests.
    
    Expected event structure for report generation:
    {
        "action": "generate_report",  // optional, default action
        "doctorUsername": "drjones",
        "patientName": "John Doe",
        "measurements": {...}
    }
    
    Expected event structure for TTS:
    {
        "action": "text_to_speech",
        "text": "Text to convert to speech"
    }
    """
    try:
        # Parse request body (handle both API Gateway and direct invocation)
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event
        
        # Route based on action
        action = body.get('action', 'generate_report')
        
        if action == 'text_to_speech':
            return handle_text_to_speech(body)
        else:
            return handle_report_generation(body)
            
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }


def handle_text_to_speech(body):
    """
    Convert text to speech using Amazon Polly Neural voices.
    
    Args:
        body (dict): Request body containing 'text' field
        
    Returns:
        dict: Response with base64-encoded audio
    """
    text = body.get('text')
    
    if not text:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Missing required field: text'})
        }
    
    try:
        # Synthesize speech using Polly Neural voice
        response = polly_client.synthesize_speech(
            Text=text,
            OutputFormat='mp3',
            VoiceId='Joanna',  # Neural voice - professional female voice
            Engine='neural',    # Use neural engine for highest quality
            TextType='text'
        )
        
        # Read audio stream
        audio_data = response['AudioStream'].read()
        
        # Encode to base64 for transmission
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'audio': audio_base64,
                'format': 'mp3'
            })
        }
        
    except Exception as e:
        print(f"Polly TTS error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'TTS generation failed: {str(e)}'})
        }


def handle_report_generation(body):
    """
    Generate medical report with Bedrock analysis.
    
    Args:
        body (dict): Request body with doctor, patient, and measurements
        
    Returns:
        dict: Response with download URL and analysis
    """
    doctor_username = body.get('doctorUsername')
    patient_name = body.get('patientName')
    measurements = body.get('measurements')
    
    # Validate inputs
    if not all([doctor_username, patient_name, measurements]):
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Missing required fields: doctorUsername, patientName, or measurements'})
        }
    
    try:
        # Step 1: Get analysis from Amazon Bedrock
        bedrock_response = get_bedrock_analysis(measurements)
        
        # Step 2: Generate PDF report
        pdf_buffer = generate_pdf_report(
            doctor_username,
            patient_name,
            measurements,
            bedrock_response
        )
        
        # Step 3: Upload to S3
        file_name = f"report_{patient_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        s3_key = f"{S3_PREFIX}{file_name}"
        
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=pdf_buffer.getvalue(),
            ContentType='application/pdf'
        )
        
        # Step 4: Generate pre-signed URL (valid for 1 hour)
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'downloadUrl': download_url,
                's3Uri': f"s3://{S3_BUCKET}/{s3_key}",
                'fileName': file_name,
                'analysis': bedrock_response,  # Include AI analysis for preview
                'message': 'Report generated successfully'
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }


def get_bedrock_analysis(measurements):
    """
    Send measurements to Amazon Bedrock (Claude) for AI analysis with ALS-specific context.
    
    Args:
        measurements (dict): Dictionary of Ca²⁺ imaging measurements
        
    Returns:
        str: Clinical analysis text from Claude
    """
    # Format measurements for context
    measurements_text = "\n".join([
        f"- {key}: {value}" for key, value in measurements.items()
        if key != 'generationDate'
    ])
    
    # Build ALS-specific context prompt
    context = (
        "Context: Astrocytes treated with sporadic ALS patient IgG exhibit three Ca²⁺ transient patterns:\n\n"
        "• Single: solitary, rapid transient (time_to_peak ≈ 20 s), driven by ER IP₃R release with minimal extracellular Ca²⁺ involvement.\n"
        "• Bursting: high-frequency repetitive transients (dominant_freq ≈ 0.11 Hz; intervals ≈ 9 s), reflecting cycles of ER release and partial store‐operated Ca²⁺ entry.\n"
        "• Repetitive: isolated transients (>20 s apart), consistent with episodic IP₃ production and delayed ER refill.\n\n"
        "Classification is based on event count, inter‐event interval, and dominant frequency within the first 50 s post‐onset.\n\n"
        "Please generate a medical‐style report (findings, interpretation, and brief diagnostic comment). "
        "Be concise and give final judgement if the patient has possibility of ALS.\n\n"
        f"Metrics:\n{measurements_text}"
    )
    
    # Prepare request for Bedrock (Anthropic Messages API format)
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1000,
        "temperature": 0.7,
        "system": "You are a clinical laboratory specialist report system. Write concise, formal medical reports of Ca²⁺ imaging findings in astrocytes.",
        "messages": [
            {
                "role": "user",
                "content": context
            }
        ]
    }
    
    try:
        response = bedrock_runtime.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(request_body),
            contentType='application/json',
            accept='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        
        # Extract text from Anthropic response
        analysis = response_body.get('content', [{}])[0].get('text', 'No analysis generated')
        
        return analysis
        
    except Exception as e:
        print(f"Bedrock error: {str(e)}")
        return f"AI analysis temporarily unavailable. Please review measurements manually."


def generate_pdf_report(doctor_username, patient_name, measurements, analysis):
    """
    Generate a PDF medical report using ReportLab (NO PIL required).
    
    Args:
        doctor_username (str): Doctor's username
        patient_name (str): Patient's full name
        measurements (dict): Experiment measurements
        analysis (str): Bedrock analysis text
        
    Returns:
        BytesIO: PDF file buffer
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#E31E24'),
        spaceAfter=30,
        alignment=1  # Center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#E31E24'),
        spaceAfter=12
    )
    
    # Title - try to use SVG logo if svglib is available
    if SVG_SUPPORT:
        try:
            # Write SVG to temp file and convert
            with open('/tmp/logo.svg', 'w') as f:
                f.write(LOGO_SVG_DATA)
            drawing = svg2rlg('/tmp/logo.svg')
            if drawing:
                # Scale the logo to fit nicely
                drawing.width = 175 * 1.5
                drawing.height = 40 * 1.5
                drawing.scale(1.5, 1.5)
                story.append(drawing)
                story.append(Spacer(1, 0.2 * inch))
        except Exception as e:
            print(f"Error rendering SVG logo: {e}")
            story.append(Paragraph("dAIgnostics", title_style))
    else:
        story.append(Paragraph("dAIgnostics", title_style))
    
    story.append(Paragraph("Neurological Analysis Report", styles['Heading2']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Report metadata
    report_date = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    story.append(Paragraph(f"<b>Report Date:</b> {report_date}", styles['Normal']))
    story.append(Paragraph(f"<b>Physician:</b> Dr. {doctor_username}", styles['Normal']))
    story.append(Paragraph(f"<b>Patient:</b> {patient_name}", styles['Normal']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Experiment measurements
    story.append(Paragraph("Measurement Results", heading_style))
    
    measurement_labels = {
        'peakCounts': ('Peak Counts', ''),
        'amplitude': ('Amplitude', 'mV'),
        'auc': ('Area Under Curve', ''),
        'fwhm': ('FWHM', 'ms'),
        'frequency': ('Frequency', 'Hz'),
        'snr': ('Signal-to-Noise Ratio', 'dB'),
        'skewness': ('Skewness', ''),
        'kurtosis': ('Kurtosis', ''),
        'generationDate': ('Test Date', '')
    }
    
    table_data = [['Measurement', 'Value', 'Unit']]
    for key, value in measurements.items():
        label, unit = measurement_labels.get(key, (key, ''))
        if key == 'generationDate':
            formatted_value = datetime.fromisoformat(value.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')
        else:
            formatted_value = f"{float(value):.2f}" if isinstance(value, (int, float)) else str(value)
        table_data.append([label, formatted_value, unit])
    
    table = Table(table_data, colWidths=[3*inch, 1.5*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E31E24')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 0.3 * inch))
    
    # AI Analysis
    story.append(Paragraph("Clinical Interpretation", heading_style))
    story.append(Paragraph(analysis, styles['Normal']))
    story.append(Spacer(1, 0.5 * inch))
    
    # Footer
    story.append(Paragraph(
        "<i>This report was generated using AI-assisted analysis and should be reviewed by a qualified medical professional.</i>",
        styles['Italic']
    ))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    return buffer

import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { createPatientCognito } from './functions/create-patient-cognito/resource';
import { predictExperiment } from './functions/predict-experiment/resource';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function } from 'aws-cdk-lib/aws-lambda';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  createPatientCognito,
  predictExperiment,
});

// Get auth resources
const userPoolArn = backend.auth.resources.userPool.userPoolArn;
const userPoolId = backend.auth.resources.userPool.userPoolId;

// Get the Lambda function directly from the backend (not through data)
const lambdaFn = backend.createPatientCognito.resources.lambda as Function;

lambdaFn.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminSetUserPassword',
    ],
    resources: [userPoolArn],
  })
);

lambdaFn.addEnvironment('USER_POOL_ID', userPoolId);

// Permission for predict-experiment to invoke lambda_master
const predictFn = backend.predictExperiment.resources.lambda as Function;
predictFn.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['lambda:InvokeFunction'],
    resources: ['arn:aws:lambda:eu-north-1:554095889481:function:lambda_master'],
  })
);

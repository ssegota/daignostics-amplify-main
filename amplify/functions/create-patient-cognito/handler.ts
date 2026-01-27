import type { Handler } from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});

// AppSync invokes Lambda with arguments nested under 'arguments' property
interface AppSyncEvent {
    arguments?: {
        email: string;
        firstName: string;
        lastName: string;
    };
    // Direct invocation format
    email?: string;
    firstName?: string;
    lastName?: string;
}

interface CreatePatientResponse {
    success: boolean;
    username?: string;
    password?: string;
    cognitoSub?: string;
    error?: string;
}

// Generate a secure random password
function generatePassword(): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*';

    let password = '';
    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest with random characters
    const allChars = lowercase + uppercase + numbers + special;
    for (let i = 0; i < 8; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

export const handler: Handler<AppSyncEvent, CreatePatientResponse> = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Handle both AppSync invocation (event.arguments) and direct invocation
    const args = event.arguments || event;
    const { email, firstName, lastName } = args;
    const userPoolId = process.env.USER_POOL_ID;

    if (!email || !firstName || !lastName) {
        return {
            success: false,
            error: 'Missing required fields: email, firstName, lastName',
        };
    }

    if (!userPoolId) {
        return {
            success: false,
            error: 'USER_POOL_ID environment variable not configured',
        };
    }

    const password = generatePassword();

    try {
        // Create the user with a temporary password
        const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
                { Name: 'given_name', Value: firstName },
                { Name: 'family_name', Value: lastName },
            ],
            MessageAction: MessageActionType.SUPPRESS, // Don't send welcome email
        });

        const createResponse = await cognitoClient.send(createUserCommand);
        console.log('User created successfully:', email);

        // Extract the Cognito sub (userId) from the response
        const cognitoSub = createResponse.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value;
        console.log('Cognito sub:', cognitoSub);

        // Set a permanent password
        const setPasswordCommand = new AdminSetUserPasswordCommand({
            UserPoolId: userPoolId,
            Username: email,
            Password: password,
            Permanent: true,
        });

        await cognitoClient.send(setPasswordCommand);
        console.log('Password set successfully for:', email);

        return {
            success: true,
            username: email,
            password: password,
            cognitoSub: cognitoSub, // Return the actual Cognito user ID for authorization
        };
    } catch (error: any) {
        console.error('Error creating Cognito user:', error);
        return {
            success: false,
            error: error.message || 'Failed to create Cognito user',
        };
    }
};

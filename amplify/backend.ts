import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function } from 'aws-cdk-lib/aws-lambda';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
});

// Get auth resources
const userPoolArn = backend.auth.resources.userPool.userPoolArn;
const userPoolId = backend.auth.resources.userPool.userPoolId;

// Grant the Lambda function (defined as data handler) permission to manage Cognito users
// Iterate over all functions to find the create-patient-cognito Lambda
const functions = backend.data.resources.functions;
for (const [name, fn] of Object.entries(functions)) {
  console.log('Found function:', name);
  if (name.includes('createPatientCognito') || name.includes('create-patient-cognito')) {
    const lambdaFn = fn as Function;

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
    console.log('Configured Lambda:', name);
  }
}


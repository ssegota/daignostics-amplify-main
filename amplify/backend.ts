import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { createPatientCognito } from './functions/create-patient-cognito/resource';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { Function } from 'aws-cdk-lib/aws-lambda';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  createPatientCognito,
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

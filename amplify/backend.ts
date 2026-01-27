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

// Grant the Lambda function permission to manage Cognito users
const userPoolId = backend.auth.resources.userPool.userPoolId;
const userPoolArn = backend.auth.resources.userPool.userPoolArn;

// Get the underlying Lambda Function construct
const lambdaFunction = backend.createPatientCognito.resources.lambda as Function;

lambdaFunction.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminSetUserPassword',
    ],
    resources: [userPoolArn],
  })
);

// Add the User Pool ID as an environment variable for the Lambda
lambdaFunction.addEnvironment('USER_POOL_ID', userPoolId);

// Grant authenticated users permission to invoke the Lambda function
// Using grantInvoke for more reliable permissions
const authenticatedRole = backend.auth.resources.authenticatedUserIamRole;
lambdaFunction.grantInvoke(authenticatedRole);

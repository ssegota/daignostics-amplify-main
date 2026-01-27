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

// Grant the Lambda function (defined as data handler) permission to manage Cognito users
const createPatientLambda = backend.data.resources.functions['createPatientCognitoUser'] as Function | undefined;
if (createPatientLambda) {
  const userPoolArn = backend.auth.resources.userPool.userPoolArn;
  const userPoolId = backend.auth.resources.userPool.userPoolId;

  createPatientLambda.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
      ],
      resources: [userPoolArn],
    })
  );

  createPatientLambda.addEnvironment('USER_POOL_ID', userPoolId);
}

import { defineFunction } from '@aws-amplify/backend';

export const createPatientCognito = defineFunction({
    name: 'create-patient-cognito',
    entry: './handler.ts',
    resourceGroupName: 'auth', // Assign to auth stack to avoid circular dependency
});

import { defineFunction } from '@aws-amplify/backend';

export const createPatientCognito = defineFunction({
    name: 'create-patient-cognito',
    entry: './handler.ts',
});

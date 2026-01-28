import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { createPatientCognito } from '../functions/create-patient-cognito/resource';
import { predictExperiment } from '../functions/predict-experiment/resource';

const schema = a.schema({
    Doctor: a
        .model({
            username: a.id().required(),
            email: a.string().required(),
            firstName: a.string(),
            lastName: a.string(),
            primaryInstitution: a.string(),
            primaryInstitutionAddress: a.string(),
            secondaryInstitution: a.string(),
            secondaryInstitutionAddress: a.string(),
        })
        .authorization((allow) => [allow.owner()]),

    Patient: a
        .model({
            firstName: a.string().required(),
            lastName: a.string().required(),
            email: a.string(),
            cognitoId: a.string(),
            doctor: a.string().required(),
            dateOfBirth: a.string(),
            gender: a.string(),
            insuranceNumber: a.string(),
        })
        .authorization((allow) => [
            allow.owner(), // Doctor (creator) has full access
            allow.ownerDefinedIn('cognitoId') // Patient (assigned via cognitoId) has full access (read/write)
        ]),

    Experiment: a
        .model({
            patientId: a.string().required(),
            patientCognitoId: a.string(), // Field to grant access to the patient
            generationDate: a.datetime().required(),
            // Spectral features stored as JSON string (39 features)
            spectralFeatures: a.string().required(),
            // ML Results
            consensusPrediction: a.integer(), // 0 or 1
            consensusConfidence: a.float(),   // 0.0-1.0
            averageProbabilities: a.string(), // JSON array [prob0, prob1]
            individualResults: a.string(),    // JSON of per-model results
            modelsUsed: a.integer(),
        })
        .authorization((allow) => [
            allow.owner(), // Doctor (creator) has full access
            allow.ownerDefinedIn('patientCognitoId') // Patient has access
        ]),

    // Custom mutation to create a Cognito user for a patient
    createPatientCognitoUser: a
        .mutation()
        .arguments({
            email: a.string().required(),
            firstName: a.string().required(),
            lastName: a.string().required(),
        })
        .returns(a.customType({
            success: a.boolean().required(),
            username: a.string(),
            password: a.string(),
            cognitoSub: a.string(), // The actual Cognito user ID for authorization
            error: a.string(),
        }))
        .handler(a.handler.function(createPatientCognito))
        .authorization((allow) => [allow.authenticated()]),

    // Custom query to invoke ML model
    predictExperiment: a
        .query()
        .arguments({
            features: a.string().required(),
        })
        .returns(a.string())
        .handler(a.handler.function(predictExperiment))
        .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'userPool',
    },
});

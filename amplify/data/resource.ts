import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
    Doctor: a
        .model({
            username: a.id().required(),
            password: a.string().required(),
            email: a.string().required(),
            firstName: a.string(),
            lastName: a.string(),
            primaryInstitution: a.string(),
            primaryInstitutionAddress: a.string(),
            secondaryInstitution: a.string(),
            secondaryInstitutionAddress: a.string(),
        })
        .authorization((allow) => [allow.publicApiKey()]),

    Patient: a
        .model({
            firstName: a.string().required(),
            lastName: a.string().required(),
            doctor: a.string().required(),
            dateOfBirth: a.string(),
            gender: a.string(),
            insuranceNumber: a.string(),
            height: a.float(),
            weight: a.float(),
        })
        .authorization((allow) => [allow.publicApiKey()]),

    Experiment: a
        .model({
            patientId: a.string().required(),
            peakCounts: a.float().required(),
            amplitude: a.float().required(),
            auc: a.float().required(),
            fwhm: a.float().required(),
            frequency: a.float().required(),
            snr: a.float().required(),
            skewness: a.float().required(),
            kurtosis: a.float().required(),
            generationDate: a.datetime().required(),
        })
        .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'apiKey',
        apiKeyAuthorizationMode: {
            expiresInDays: 30,
        },
    },
});

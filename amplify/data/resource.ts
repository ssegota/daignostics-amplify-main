import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
    Doctor: a
        .model({
            username: a.id().required(),
            password: a.string().required(),
            email: a.string().required(),
        })
        .authorization((allow) => [allow.publicApiKey()]),

    Patient: a
        .model({
            firstName: a.string().required(),
            lastName: a.string().required(),
            doctor: a.string().required(),
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

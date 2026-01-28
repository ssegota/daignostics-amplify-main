import { defineFunction } from '@aws-amplify/backend';

export const predictExperiment = defineFunction({
    name: 'predict-experiment',
    entry: './handler.ts',
    timeoutSeconds: 60
});

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient({});

export const handler = async (event: any) => {
    console.log("Predict Experiment wrapper invoked:", event);
    const { features } = event.arguments;

    // features is passed as a stringified JSON from frontend
    // lambda_master expects the event to BE the data dictionary or have a body
    // We will pass the parsed object as the payload directly

    try {
        const payloadObj = JSON.parse(features);

        const command = new InvokeCommand({
            FunctionName: "lambda_master",
            Payload: JSON.stringify(payloadObj),
        });

        const response = await client.send(command);

        if (response.FunctionError) {
            throw new Error(`Lambda invocation error: ${response.FunctionError}`);
        }

        const responsePayload = JSON.parse(new TextDecoder().decode(response.Payload));
        console.log("Master Lambda Response:", responsePayload);

        // lambda_master returns { statusCode: 200, body: "..." }
        if (responsePayload.body) {
            // responsePayload.body is a stringified JSON of the ML result
            return responsePayload.body;
        }

        // If something else returned
        return JSON.stringify(responsePayload);

    } catch (error) {
        console.error("Error invoking lambda_master:", error);
        throw error;
    }
};

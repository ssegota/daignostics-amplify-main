import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn, signOut, getCurrentUser } from 'aws-amplify/auth';
import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminDeleteUserCommand,
    ListUsersCommand
} from '@aws-sdk/client-cognito-identity-provider';
import type { Schema } from '../amplify/data/resource';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient<Schema>();

// Use 'any' to bypass strict type checking on the outputs structure if needed, 
// though verify your amplify_outputs.json structure usually matches this.
const authConfig = (outputs as any).auth;
const cognitoClient = new CognitoIdentityProviderClient({ region: authConfig.aws_region });

const firstNames = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen'
];

const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'
];

const doctors = [
    {
        username: 'drjones',
        password: 'Password123!', // Stronger password for Cognito policies
        email: 'drjones@daignostics.info',
        firstName: 'Indiana',
        lastName: 'Jones',
        primaryInstitution: 'Marshall College',
        primaryInstitutionAddress: '184 Main St, Bedford, CT 06810'
    },
    {
        username: 'drsmith',
        password: 'Password123!',
        email: 'drsmith@daignostics.info',
        firstName: 'John',
        lastName: 'Smith',
        primaryInstitution: 'General Hospital',
        primaryInstitutionAddress: '101 Healing Way, Metropolis, NY 10001',
        secondaryInstitution: 'City Clinic',
        secondaryInstitutionAddress: '55 Healthy Ave, Gotham, NJ 07001'
    },
    {
        username: 'drbrown',
        password: 'Password123!',
        email: 'drbrown@daignostics.info',
        firstName: 'Emmett',
        lastName: 'Brown',
        primaryInstitution: 'Hill Valley Science Center',
        primaryInstitutionAddress: '1640 Riverside Dr, Hill Valley, CA 95420'
    },
];

function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function randomDate(start: Date, end: Date): string {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

function randomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const SPECTRAL_FEATURES = [
    'ch0_total_power', 'ch0_peak_freq', 'ch0_peak_power', 'ch0_centroid', 'ch0_bandwidth',
    'ch0_rolloff95', 'ch0_flatness', 'ch0_entropy', 'ch0_slope', 'ch0_bp_uSlow',
    'ch0_bp_slow', 'ch0_bp_mid', 'ch0_bp_fast',
    'ch1_total_power', 'ch1_peak_freq', 'ch1_peak_power', 'ch1_centroid', 'ch1_bandwidth',
    'ch1_rolloff95', 'ch1_flatness', 'ch1_entropy', 'ch1_slope', 'ch1_bp_uSlow',
    'ch1_bp_slow', 'ch1_bp_mid', 'ch1_bp_fast',
    'ch2_total_power', 'ch2_peak_freq', 'ch2_peak_power', 'ch2_centroid', 'ch2_bandwidth',
    'ch2_rolloff95', 'ch2_flatness', 'ch2_entropy', 'ch2_slope', 'ch2_bp_uSlow',
    'ch2_bp_slow', 'ch2_bp_mid', 'ch2_bp_fast'
];

function generateSpectralFeatures(): Record<string, number> {
    const features: Record<string, number> = {};
    SPECTRAL_FEATURES.forEach(feature => {
        features[feature] = randomFloat(0, 10);
    });
    return features;
}

function generateMLResults() {
    const prediction = Math.random() > 0.5 ? 1 : 0;
    const confidence = randomFloat(0.6, 1.0);
    const prob0 = prediction === 0 ? confidence : 1 - confidence;
    const prob1 = 1 - prob0;

    // Generate individual results
    const models = ["DT", "ET", "KNN", "LDA", "GNB", "RFC"];
    const individualResults = models.map(model => {
        // Most models agree with consensus
        const modelPred = Math.random() > 0.2 ? prediction : (1 - prediction);
        return {
            model,
            prediction: modelPred,
            probabilities: [
                modelPred === 0 ? randomFloat(0.6, 0.9) : randomFloat(0.1, 0.4),
                modelPred === 1 ? randomFloat(0.6, 0.9) : randomFloat(0.1, 0.4)
            ],
            error: null
        };
    });

    const modelsUsed = models.length;

    return {
        consensusPrediction: prediction,
        consensusConfidence: confidence,
        averageProbabilities: JSON.stringify([prob0, prob1]),
        individualResults: JSON.stringify(individualResults),
        modelsUsed
    };
}

function generateExperiment(patientId: string) {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 180); // Random date within last 6 months
    const experimentDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const mlData = generateMLResults();

    return {
        patientId,
        patientCognitoId: '', // To be filled in later
        generationDate: experimentDate.toISOString(),
        spectralFeatures: JSON.stringify(generateSpectralFeatures()),
        ...mlData
    };
}

// Function to clean up ALL Cognito users that are not the hardcoded doctors
async function cleanupOldCognitoUsers() {
    console.log('🧹 Cleaning up old Cognito users...');

    // List of emails we want to KEEP (the doctors)
    const doctorEmails = new Set(doctors.map(d => d.email));

    let paginationToken: string | undefined;
    let deletedCount = 0;

    try {
        do {
            const response = await cognitoClient.send(new ListUsersCommand({
                UserPoolId: authConfig.user_pool_id,
                PaginationToken: paginationToken
            }));

            paginationToken = response.PaginationToken;

            for (const user of response.Users || []) {
                const emailAttr = user.Attributes?.find(a => a.Name === 'email');
                const email = emailAttr?.Value;

                // If it's a doctor, skip deletion here (the loop below re-creates them anyway, 
                // but checking here prevents "deletion" log spam if we wanted to preserve them, 
                // though the main loop deletes doctors anyway. We'll delete non-doctors here.)

                // Actually, let's delete EVERYONE to be clean, or just patients.
                // The Seed loop deletes doctors. Let's delete only NON-doctors here to save time/calls
                // and let the loop handle doctors.
                if (email && doctorEmails.has(email)) {
                    continue;
                }

                if (user.Username) {
                    try {
                        await cognitoClient.send(new AdminDeleteUserCommand({
                            UserPoolId: authConfig.user_pool_id,
                            Username: user.Username
                        }));
                        deletedCount++;
                        if (deletedCount % 10 === 0) process.stdout.write('.');
                    } catch (e) {
                        // ignore errors
                    }
                }
            }
        } while (paginationToken);
    } catch (err) {
        console.error('Error listing/deleting users:', err);
    }

    console.log(`\n   - Deleted ${deletedCount} old Cognito users.`);
}

async function createCognitoUser(email: string, givenName: string, familyName: string, password = 'Password123!'): Promise<string | null> {
    try {
        console.log(`   - Creating Cognito user for ${email}...`);

        // Try delete first (cleanup)
        try {
            await cognitoClient.send(new AdminDeleteUserCommand({
                UserPoolId: authConfig.user_pool_id,
                Username: email
            }));
        } catch (e) { }

        const createUserResponse = await cognitoClient.send(new AdminCreateUserCommand({
            UserPoolId: authConfig.user_pool_id,
            Username: email,
            UserAttributes: [
                { Name: 'email', Value: email },
                { Name: 'email_verified', Value: 'true' },
                { Name: 'given_name', Value: givenName },
                { Name: 'family_name', Value: familyName }
            ],
            MessageAction: 'SUPPRESS'
        }));

        await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: authConfig.user_pool_id,
            Username: email,
            Password: password,
            Permanent: true
        }));

        // Fetch the user to get the 'sub' (User ID)
        // Actually, AdminCreateUser returns the user object with attributes
        const subAttribute = createUserResponse.User?.Attributes?.find(attr => attr.Name === 'sub');
        if (subAttribute) {
            return subAttribute.Value || null;
        }

        // Fallback: we might need to fetch user if sub isn't in response (usually it is)
        return null;

    } catch (error) {
        console.error(`   ❌ Error creating Cognito user ${email}:`, error);
        return null;
    }
}

async function cleanUpDoctorData(doctorUsername: string) {
    // Assuming we are signed in as the doctor
    console.log(`🧹 Cleaning up data for ${doctorUsername}...`);

    // Delete experiments
    try {
        const experiments = await client.models.Experiment.list({ limit: 1000 });
        for (const exp of experiments.data || []) {
            await client.models.Experiment.delete({ id: exp.id });
        }
        console.log(`   - Deleted ${experiments.data.length} experiments`);
    } catch (e) {
        console.log(`   - Error deleting experiments (might be empty or permission issue): ${e}`);
    }

    // Delete patients
    try {
        const patients = await client.models.Patient.list({ limit: 1000 });
        for (const p of patients.data || []) {
            await client.models.Patient.delete({ id: p.id });
        }
        console.log(`   - Deleted ${patients.data.length} patients`);
    } catch (e) {
        console.log(`   - Error deleting patients: ${e}`);
    }

    // Delete doctor profile
    try {
        await client.models.Doctor.delete({ username: doctorUsername } as any);
        console.log(`   - Deleted doctor profile`);
    } catch (e) {
        console.log(`   - Msg: Could not delete profile (may not exist)`);
    }
}

async function seedDatabase() {
    console.log('🌱 Starting database seeding with Cognito integration...\n');

    // Step 0: Clean up OLD patients from Cognito
    await cleanupOldCognitoUsers();

    for (const doctor of doctors) {
        console.log(`\nProcessing Dr. ${doctor.lastName} (${doctor.username})...`);

        // 1. Try to Authenticate to clean up OLD data if user exists
        let isAuthenticated = false;
        try {
            await signIn({ username: doctor.email, password: doctor.password });
            const user = await getCurrentUser();
            console.log(`✅ Authentication successful. User ID: ${user.username}`);
            isAuthenticated = true;
            // Clean up using the ACTUAL username (sub) if possible, or try to clean up by email if we stored it that way before
            // But realistically, we just want to suppress errors if it fails
            await cleanUpDoctorData(user.username);
            await signOut();
        } catch (error: any) {
            console.log(`ℹ️ Could not sign in (User might not exist yet): ${error.message}`);
        }

        // 2. Reset (Delete & Recreate) Cognito User
        console.log(`🔄 Resetting Cognito User...`);
        try {
            // Try delete first
            await cognitoClient.send(new AdminDeleteUserCommand({
                UserPoolId: authConfig.user_pool_id,
                Username: doctor.email
            }));
            console.log(`   - Deleted existing user.`);
        } catch (e) {
            // Ignore if user doesn't exist
        }

        try {
            await cognitoClient.send(new AdminCreateUserCommand({
                UserPoolId: authConfig.user_pool_id,
                Username: doctor.email,
                UserAttributes: [
                    { Name: 'email', Value: doctor.email },
                    { Name: 'email_verified', Value: 'true' },
                    { Name: 'given_name', Value: doctor.firstName },
                    { Name: 'family_name', Value: doctor.lastName }
                ],
                MessageAction: 'SUPPRESS'
            }));

            await cognitoClient.send(new AdminSetUserPasswordCommand({
                UserPoolId: authConfig.user_pool_id,
                Username: doctor.email,
                Password: doctor.password,
                Permanent: true
            }));
            console.log(`   - Created new user and set password.`);
        } catch (error) {
            console.error(`❌ Error creating Cognito user:`, error);
            continue; // Skip to next doctor
        }

        // 3. Sign In with new user to generate data
        console.log(`🔐 Signing in to seed data...`);
        let userId = '';
        try {
            await signIn({ username: doctor.email, password: doctor.password });
            const user = await getCurrentUser();
            userId = user.username;
            console.log(`   - Signed in as ${userId}`);
        } catch (error) {
            console.error(`❌ Failed to sign in after creation:`, error);
            continue;
        }

        // 4. Create Doctor Profile
        console.log(`📝 Creating Doctor Profile...`);
        try {
            await client.models.Doctor.create({
                username: userId, // Use the ACTUAL Cognito User Sub
                email: doctor.email,
                firstName: doctor.firstName,
                lastName: doctor.lastName,
                primaryInstitution: doctor.primaryInstitution,
                primaryInstitutionAddress: doctor.primaryInstitutionAddress,
                secondaryInstitution: doctor.secondaryInstitution,
                secondaryInstitutionAddress: doctor.secondaryInstitutionAddress
            });
            console.log(`   - Profile created.`);
        } catch (error) {
            console.error(`❌ Failed to create profile:`, error);
        }

        // 5. Create Patients & Experiments
        console.log(`👥 Creating Patients & Experiments...`);
        const patientCount = Math.floor(Math.random() * 6) + 15; // 15-20 patients

        for (let i = 0; i < patientCount; i++) {
            const pFirstName = getRandomElement(firstNames);
            const pLastName = getRandomElement(lastNames);
            // Construct a fake email for the patient
            const pEmail = `${pFirstName.toLowerCase()}.${pLastName.toLowerCase()}.${Date.now()}@daignostics.info`;

            // 5a. Create Cognito User for Patient
            const patientSub = await createCognitoUser(pEmail, pFirstName, pLastName, 'Password123!');

            if (!patientSub) {
                console.log(`   ⚠️ Skipping patient creation because Cognito user failed.`);
                continue;
            }

            const patientData = {
                firstName: pFirstName,
                lastName: pLastName,
                email: pEmail,
                cognitoId: patientSub,
                doctor: userId, // Link to the ACTUAL Cognito User Sub (Owner)
                dateOfBirth: randomDate(new Date(1950, 0, 1), new Date(2005, 0, 1)),
                gender: getRandomElement(['Male', 'Female']),
                insuranceNumber: randomString(10),
            };

            const newPatient = await client.models.Patient.create(patientData);

            if (newPatient.data) {
                // Create experiments for this patient (0-5 experiments)
                const experimentCount = Math.floor(Math.random() * 6); // 0-5 experiments
                for (let j = 0; j < experimentCount; j++) {
                    const expData = generateExperiment(newPatient.data.id);
                    expData.patientCognitoId = patientSub; // Grant access to patient
                    await client.models.Experiment.create(expData);
                }
            }
        }
        console.log(`   - Created ${patientCount} patients.`);

        // 6. Sign Out
        await signOut();
        console.log(`👋 Done with ${doctor.username}.\n`);
    }

    console.log('\n✨ Database seeding complete!\n');
    console.log('Login credentials for doctors:');
    doctors.forEach(doctor => {
        console.log(`  Username: ${doctor.email}, Password: ${doctor.password}`);
    });
}

seedDatabase()
    .then(() => {
        console.log('\n✅ Seed script finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Seed script failed:', error);
        process.exit(1);
    });

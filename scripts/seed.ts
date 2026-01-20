import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient<Schema>();

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
    { username: 'drjones', password: 'password123', email: 'drjones@daignostics.info' },
    { username: 'drsmith', password: 'password123', email: 'drsmith@daignostics.info' },
    { username: 'drbrown', password: 'password123', email: 'drbrown@daignostics.info' },
];

function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function generateExperiment(patientId: string) {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 180); // Random date within last 6 months
    const experimentDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    return {
        patientId,
        peakCounts: Math.floor(randomFloat(10, 100)),
        amplitude: randomFloat(0.5, 10.0),
        auc: randomFloat(100, 1000),
        fwhm: randomFloat(0.1, 5.0),
        frequency: randomFloat(1, 100),
        snr: randomFloat(5, 50),
        skewness: randomFloat(-2, 2),
        kurtosis: randomFloat(1, 10),
        generationDate: experimentDate.toISOString(),
    };
}

async function seedDatabase() {
    console.log('🌱 Starting database seeding...\n');

    // Create doctors
    console.log('Creating doctors...');
    for (const doctor of doctors) {
        try {
            await client.models.Doctor.create(doctor);
            console.log(`✅ Created doctor: ${doctor.username}`);
        } catch (error) {
            console.error(`❌ Error creating doctor ${doctor.username}:`, error);
        }
    }

    console.log('\nCreating patients and experiments...');

    const allPatientIds: string[] = [];

    // Create patients for each doctor
    for (const doctor of doctors) {
        const patientCount = Math.floor(Math.random() * 6) + 3; // 3-8 patients per doctor

        for (let i = 0; i < patientCount; i++) {
            const patient = {
                firstName: getRandomElement(firstNames),
                lastName: getRandomElement(lastNames),
                doctor: doctor.username,
            };

            try {
                const created = await client.models.Patient.create(patient);
                console.log(`✅ Created patient: ${patient.firstName} ${patient.lastName} for ${doctor.username}`);

                if (created.data?.id) {
                    allPatientIds.push(created.data.id);
                }
            } catch (error) {
                console.error(`❌ Error creating patient:`, error);
            }
        }
    }

    console.log('\nCreating experiments for patients...');

    let totalExperiments = 0;
    for (const patientId of allPatientIds) {
        const experimentCount = Math.floor(Math.random() * 5) + 2; // 2-6 experiments per patient

        for (let i = 0; i < experimentCount; i++) {
            const experiment = generateExperiment(patientId);

            try {
                await client.models.Experiment.create(experiment);
                totalExperiments++;
            } catch (error) {
                console.error(`❌ Error creating experiment for patient ${patientId}:`, error);
            }
        }
    }

    console.log(`✅ Created ${totalExperiments} experiments\n`);

    console.log('\n✨ Database seeding complete!\n');
    console.log('Login credentials for doctors:');
    doctors.forEach(doctor => {
        console.log(`  Username: ${doctor.username}, Password: ${doctor.password}`);
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

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

    console.log('\nCreating patients...');

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
                await client.models.Patient.create(patient);
                console.log(`✅ Created patient: ${patient.firstName} ${patient.lastName} for ${doctor.username}`);
            } catch (error) {
                console.error(`❌ Error creating patient:`, error);
            }
        }
    }

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

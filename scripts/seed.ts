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
    {
        username: 'drjones',
        password: 'password123',
        email: 'drjones@daignostics.info',
        firstName: 'Indiana',
        lastName: 'Jones',
        primaryInstitution: 'Marshall College',
        primaryInstitutionAddress: '184 Main St, Bedford, CT 06810'
    },
    {
        username: 'drsmith',
        password: 'password123',
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
        password: 'password123',
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

async function deleteAllData() {
    console.log('🗑️  Deleting existing data...\n');

    // Delete all experiments
    try {
        const experiments = await client.models.Experiment.list({ limit: 1000 });
        for (const exp of experiments.data || []) {
            await client.models.Experiment.delete({ id: exp.id });
        }
        console.log(`✅ Deleted ${experiments.data?.length || 0} experiments`);
    } catch (error) {
        console.error('❌ Error deleting experiments:', error);
    }

    // Delete all patients
    try {
        const patients = await client.models.Patient.list({ limit: 1000 });
        for (const patient of patients.data || []) {
            await client.models.Patient.delete({ id: patient.id });
        }
        console.log(`✅ Deleted ${patients.data?.length || 0} patients`);
    } catch (error) {
        console.error('❌ Error deleting patients:', error);
    }

    // Delete all doctors
    try {
        const doctors = await client.models.Doctor.list({ limit: 1000 });
        for (const doctor of doctors.data || []) {
            await client.models.Doctor.delete({ username: doctor.username } as any);
        }
        console.log(`✅ Deleted ${doctors.data?.length || 0} doctors`);
    } catch (error) {
        console.error('❌ Error deleting doctors:', error);
    }

    console.log('');
}

async function seedDatabase() {
    // Delete existing data first
    await deleteAllData();

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
                dateOfBirth: randomDate(new Date(1950, 0, 1), new Date(2005, 0, 1)),
                gender: getRandomElement(['Male', 'Female']),
                insuranceNumber: randomString(10),
                height: parseFloat(randomFloat(150, 200).toFixed(1)),
                weight: parseFloat(randomFloat(50, 120).toFixed(1)),
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

    // Group patients by doctor to ensure 1-2 per doctor have no experiments
    const patientsByDoctor: { [key: string]: string[] } = {};
    const allPatients = await client.models.Patient.list();

    allPatients.data?.forEach((patient) => {
        if (patient.doctor && patient.id) {
            if (!patientsByDoctor[patient.doctor]) {
                patientsByDoctor[patient.doctor] = [];
            }
            patientsByDoctor[patient.doctor].push(patient.id);
        }
    });

    // For each doctor, randomly select 1-2 patients to have NO experiments
    const patientsWithoutExperiments = new Set<string>();
    Object.values(patientsByDoctor).forEach((doctorPatients) => {
        const countWithoutExperiments = Math.random() < 0.5 ? 1 : 2; // 1 or 2 patients
        for (let i = 0; i < Math.min(countWithoutExperiments, doctorPatients.length); i++) {
            const randomIndex = Math.floor(Math.random() * doctorPatients.length);
            patientsWithoutExperiments.add(doctorPatients[randomIndex]);
        }
    });

    for (const patientId of allPatientIds) {
        // Skip if this patient should have no experiments
        if (patientsWithoutExperiments.has(patientId)) {
            console.log(`  Skipping patient ${patientId.slice(0, 8)} (no experiments)`);
            continue;
        }

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

    console.log(`✅ Created ${totalExperiments} experiments`);
    console.log(`📊 ${patientsWithoutExperiments.size} patients have no experiments\n`);

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

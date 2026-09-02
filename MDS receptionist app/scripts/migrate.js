#!/usr/bin/env node
/**
 * Database Migration & Seed Script
 * Usage: node scripts/migrate.js
 *   --seed    also insert initial demo data
 *   --reset   DROP all tables first (DESTRUCTIVE — dev only)
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const doSeed  = args.includes('--seed');
const doReset = args.includes('--reset');

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Create a .env file first.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔌  Connected to Neon Postgres');

    // ── Optional reset ──────────────────────────────────────────
    if (doReset) {
      console.log('⚠️   --reset flag detected. Dropping all tables...');
      await client.query(`
        DROP TABLE IF EXISTS
          audit_logs, appointment_reminders, prescription_items,
          prescriptions, treatments, visits, appointments,
          dental_history, patient_medications, patient_allergies,
          patient_medical_history, counters, patients,
          doctor_schedule_exceptions, doctor_availability,
          doctors, clinic_settings, users
        CASCADE;
      `);
      console.log('   Tables dropped.');
    }

    // ── Schema ──────────────────────────────────────────────────
    const schemaSQL = readFileSync(
      path.join(__dirname, '../src/server/db/schema.sql'),
      'utf-8'
    );
    await client.query(schemaSQL);
    console.log('✅  Schema applied');

    if (!doSeed) {
      console.log('ℹ️   Skipping seed (pass --seed to insert demo data)');
      return;
    }

    // ── Check if already seeded ─────────────────────────────────
    const { rows: userRows } = await client.query(`SELECT id FROM users LIMIT 1`);
    if (userRows.length > 0) {
      console.log('ℹ️   Data already exists — skipping seed to avoid duplicates.');
      console.log('    Use --reset --seed to wipe and re-seed.');
      return;
    }

    console.log('🌱  Seeding demo data...');
    await client.query('BEGIN');

    // ── Users ───────────────────────────────────────────────────
    await client.query(`
      INSERT INTO users (id, name, email, role, is_active, created_at, updated_at) VALUES
        ('user-rec-1',  'Emma Watson',        'reception@apexdentalcare.com', 'RECEPTIONIST', true, NOW(), NOW()),
        ('user-doc-1',  'Dr. Sarah Mitchell', 's.mitchell@apexdentalcare.com', 'DOCTOR',       true, NOW(), NOW()),
        ('user-doc-2',  'Dr. David Chen',     'd.chen@apexdentalcare.com',     'DOCTOR',       true, NOW(), NOW()),
        ('user-adm-1',  'Clinical Admin',     'admin@apexdentalcare.com',      'ADMIN',        true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Doctors ─────────────────────────────────────────────────
    await client.query(`
      INSERT INTO doctors (id, user_id, full_name, specialization, license_number, phone, email, color, bio, is_active) VALUES
        ('doc-1','user-doc-1','Dr. Sarah Mitchell, DDS','Orthodontics & Aesthetic Dentistry','DDS-94821','+1 (555) 234-8910','s.mitchell@apexdentalcare.com','#0d9488','Over 14 years specializing in clear aligners and smile reconstructions.',true),
        ('doc-2','user-doc-2','Dr. David Chen, DMD',   'Endodontics & Advanced Implantology','DMD-53910','+1 (555) 234-8920','d.chen@apexdentalcare.com',    '#0284c7','Board-certified Endodontist specializing in microscopic root canal therapy.',true)
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Doctor Availability (Mon–Sat 09:00–17:30) ───────────────
    for (const docId of ['doc-1', 'doc-2']) {
      for (let day = 0; day <= 6; day++) {
        const available = day !== 0; // Sunday off
        await client.query(`
          INSERT INTO doctor_availability (id, doctor_id, day_of_week, start_time, end_time, is_available)
          VALUES ($1, $2, $3, '09:00', '17:30', $4)
          ON CONFLICT (doctor_id, day_of_week) DO NOTHING
        `, [`avail-${docId}-${day}`, docId, day, available]);
      }
    }

    // ── Clinic Settings ──────────────────────────────────────────
    await client.query(`
      UPDATE clinic_settings SET
        clinic_name = 'Apex Dental Care & Implant Center',
        tagline     = 'Comprehensive Family & Advanced Restorative Dentistry',
        address_line1 = '742 Evergreen Medical Suites',
        address_line2 = 'Suite 400',
        city          = 'Metropolis',
        state         = 'NY',
        zip_code      = '10001',
        phone         = '+1 (555) 234-8900',
        alternate_phone = '+1 (555) 234-8901',
        email         = 'reception@apexdentalcare.com',
        website       = 'www.apexdentalcare.com',
        registration_number = 'MED-DEN-2024-8891',
        emergency_phone     = '+1 (555) 999-3368',
        print_header  = 'APEX DENTAL CARE & IMPLANT CENTER',
        print_footer  = 'Thank you for trusting Apex Dental Care. For emergencies, call our 24/7 helpline.',
        timezone      = 'America/New_York',
        currency_symbol = '$',
        updated_at    = NOW()
      WHERE id = 'clinic-default'
    `);

    // ── Patients ─────────────────────────────────────────────────
    await client.query(`
      INSERT INTO patients (id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        blood_group, occupation, allergies, general_medical_notes, status) VALUES
        ('pt-1','PT-000101','Eleanor','Vance',     '1988-04-12','FEMALE','+1 (555) 342-9182','eleanor.vance@example.com','142 Maplewood Avenue, Apt 3B','Robert Vance','+1 (555) 342-9180','Spouse','O+','Architectural Consultant','Penicillin (Severe anaphylaxis)','Mild seasonal asthma.',                                'ACTIVE'),
        ('pt-2','PT-000102','Marcus','Holloway',   '1975-11-23','MALE',  '+1 (555) 678-2341','m.holloway@example.com',  '88 Oakridge Boulevard',       'Clara Holloway','+1 (555) 678-2349','Wife', 'A+','Software Engineering Director','Latex (Skin rash)','Controlled hypertension on Lisinopril 10mg.',              'ACTIVE'),
        ('pt-3','PT-000103','Sophia','Alvarez',    '1996-07-30','FEMALE','+1 (555) 891-4567','sophia.alvarez@example.com','512 Elmwood Plaza',          'Maria Alvarez','+1 (555) 891-4560','Mother','B+','Graphic Designer','None reported','Healthy, non-smoker.',                                            'ACTIVE'),
        ('pt-4','PT-000104','Arthur','Pendleton',  '1959-02-18','MALE',  '+1 (555) 902-1144','arthur.p@example.com',    '23 Pinecrest Terrace',        'Judith Pendleton','+1 (555) 902-1140','Spouse','O-','Retired Principal','Aspirin, NSAIDs (Gastric distress)','Type 2 Diabetes. Takes Metformin 500mg BID.', 'ACTIVE'),
        ('pt-5','PT-000105','Aria','Kim',          '2001-09-14','FEMALE','+1 (555) 456-7890','aria.kim@example.com',    '77 University Heights, Apt 4','David Kim','+1 (555) 456-7899','Father','AB+','Biomedical Student','Sulfa Drugs','History of orthodontic treatment 2018.',                               'ACTIVE'),
        ('pt-6','PT-000106','Julian','Rossi',      '1983-12-05','MALE',  '+1 (555) 321-9988','j.rossi@example.com',     '304 Riverdale Crescent',      'Laura Rossi','+1 (555) 321-9980','Sister','A-','Culinary Chef','None reported','No significant systemic history.',                                     'ACTIVE')
      ON CONFLICT (id) DO NOTHING
    `);

    // Update counter so next patient number is correct
    await client.query(`UPDATE counters SET value = 106 WHERE name = 'patient_seq'`);
    await client.query(`UPDATE counters SET value = 100 WHERE name = 'rx_seq'`);

    // ── Patient Allergies ────────────────────────────────────────
    await client.query(`
      INSERT INTO patient_allergies (id, patient_id, allergen, reaction, severity, notes) VALUES
        ('all-1','pt-1','Penicillin',          'Severe anaphylaxis & swelling','SEVERE','Strictly contraindicate all beta-lactam antibiotics.'),
        ('all-2','pt-2','Latex Gloves / Dams', 'Contact urticaria & skin flare','HIGH', 'Use Nitrile gloves and non-latex dental dams only.'),
        ('all-3','pt-4','Aspirin / Ibuprofen', 'Severe GI bleed risk',          'MEDIUM','Prescribe Acetaminophen for analgesia only.')
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Patient Medical History ───────────────────────────────────
    await client.query(`
      INSERT INTO patient_medical_history (id, patient_id, condition, description, status, notes, created_by) VALUES
        ('mh-1','pt-1','Seasonal Asthma',       'Mild. Uses Salbutamol inhaler PRN.','CHRONIC','Dentist advised to bring inhaler to every appointment.','Dr. Sarah Mitchell'),
        ('mh-2','pt-2','Hypertension',           'Controlled on Lisinopril 10mg OD.', 'CHRONIC','Monitor BP before local anesthesia with epinephrine.', 'Dr. Sarah Mitchell'),
        ('mh-3','pt-4','Type 2 Diabetes Mellitus','HbA1c 6.8. Metformin 500mg BID.',  'CHRONIC','Morning appointments preferred. Monitor healing.', 'Dr. David Chen')
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Today's Appointments (dynamic date) ─────────────────────
    const today = new Date().toISOString().slice(0, 10);
    await client.query(`
      INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, start_time, end_time, duration_minutes, appointment_type, status, reason, created_by) VALUES
        ('apt-1','pt-1','doc-1',$1,'09:00','09:45',45,'Consultation',  'CONFIRMED', 'Full orthodontic assessment and aligner fitting review','Emma Watson'),
        ('apt-2','pt-2','doc-2',$1,'09:30','10:30',60,'Root Canal',    'ARRIVED',   'Continuing root canal treatment on molar #30 (second session)','Emma Watson'),
        ('apt-3','pt-3','doc-1',$1,'10:00','10:30',30,'Cleaning',      'SCHEDULED', 'Routine 6-month prophylaxis cleaning','Emma Watson'),
        ('apt-4','pt-4','doc-1',$1,'11:00','11:45',45,'Crown',         'IN_PROGRESS','Permanent crown cementation — tooth #14','Emma Watson'),
        ('apt-5','pt-5','doc-2',$1,'11:30','12:00',30,'Follow-up',     'SCHEDULED', 'Post-extraction healing review','Emma Watson'),
        ('apt-6','pt-6','doc-1',$1,'14:00','14:30',30,'Filling',       'SCHEDULED', 'Composite filling — tooth #3 occlusal caries','Emma Watson'),
        ('apt-7','pt-1','doc-2',$1,'15:00','15:45',45,'Implant',       'SCHEDULED', 'Titanium implant placement consultation — site #19','Emma Watson'),
        ('apt-8','pt-3','doc-2',$1,'16:00','16:30',30,'Consultation',  'SCHEDULED', 'TMJ assessment and night guard fitting','Emma Watson')
      ON CONFLICT (id) DO NOTHING
    `, [today]);

    // ── Treatments ───────────────────────────────────────────────
    await client.query(`
      INSERT INTO treatments (id, patient_id, doctor_id, appointment_id, treatment_name, treatment_type, tooth_number, status, cost, notes) VALUES
        ('trt-1','pt-1','doc-1','apt-1','Clear Aligner Fitting','Orthodontic',NULL,'COMPLETED',1200,'Invisalign Phase 1 upper arch — 14 trays prescribed.'),
        ('trt-2','pt-2','doc-2','apt-2','Root Canal Therapy',   'Endodontic', 30,  'IN_PROGRESS',950,'Session 2 of 2. Obturation pending.'),
        ('trt-3','pt-4','doc-1','apt-4','Permanent Crown',      'Restorative',14,  'COMPLETED',  800,'E-MAX ceramic crown cemented. Patient comfortable.'),
        ('trt-4','pt-6','doc-1','apt-6','Composite Filling',    'Restorative',3,   'PLANNED',    180,'Class I occlusal composite.'),
        ('trt-5','pt-3','doc-1',NULL,   'Prophylaxis Cleaning', 'Preventive', NULL,'COMPLETED',  120,'Standard 6-month cleaning and fluoride varnish.')
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Prescriptions ────────────────────────────────────────────
    await client.query(`
      INSERT INTO prescriptions (id, rx_number, patient_id, doctor_id, prescription_date, diagnosis, instructions, status) VALUES
        ('rx-1','RX-2026-0101','pt-2','doc-2',CURRENT_DATE,'Post Root Canal Analgesic Protocol','Take medicines as directed. Avoid hard foods for 48 hours. Return if pain persists beyond 3 days.','ACTIVE'),
        ('rx-2','RX-2026-0102','pt-4','doc-1',CURRENT_DATE,'Post Crown Cementation','Avoid sticky or hard foods for 24 hours. Mild sensitivity is normal.','ACTIVE')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query(`UPDATE counters SET value = 102 WHERE name = 'rx_seq'`);

    await client.query(`
      INSERT INTO prescription_items (id, prescription_id, medicine_name, strength, dosage, frequency, duration, route, instructions, sort_order) VALUES
        ('rxi-1','rx-1','Ibuprofen',       '400mg', '1 tablet','TID (3x daily)','5 days','Oral','After food',0),
        ('rxi-2','rx-1','Amoxicillin',     '500mg', '1 capsule','TID (3x daily)','7 days','Oral','Complete full course',1),
        ('rxi-3','rx-1','Chlorhexidine Mouthwash','0.2%','15ml rinse','Twice daily','7 days','Mouth Rinse','Rinse for 30 seconds after brushing. Do not swallow.',2),
        ('rxi-4','rx-2','Acetaminophen',   '500mg', '1–2 tablets','Q6H PRN','3 days','Oral','Only if pain. Max 4g/day.',0),
        ('rxi-5','rx-2','Chlorhexidine Mouthwash','0.2%','15ml rinse','Twice daily','3 days','Mouth Rinse','Gentle rinse only.',1)
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Reminders ────────────────────────────────────────────────
    await client.query(`
      INSERT INTO appointment_reminders (id, appointment_id, patient_id, type, channel, scheduled_at, sent_at, status, message, recipient) VALUES
        ('rem-1','apt-1','pt-1','CONFIRMATION','SMS', NOW(), NOW(), 'SENT',
          'Dear Eleanor Vance, your appointment with Dr. Sarah Mitchell is confirmed for today at 09:00 AM at Apex Dental Care. Phone: +1 (555) 234-8900.',
          '+1 (555) 342-9182'),
        ('rem-2','apt-3','pt-3','REMINDER','EMAIL', NOW(), NULL, 'PENDING',
          'Reminder: You have a scheduled appointment today at 10:00 AM with Dr. Sarah Mitchell at Apex Dental Care.',
          'sophia.alvarez@example.com'),
        ('rem-3','apt-5','pt-5','CONFIRMATION','SMS', NOW(), NOW(), 'SENT',
          'Dear Aria Kim, your follow-up appointment with Dr. David Chen is confirmed for today at 11:30 AM.',
          '+1 (555) 456-7890')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('✅  Seed complete — 6 patients, 2 doctors, 8 appointments, 5 treatments, 2 prescriptions');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌  Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

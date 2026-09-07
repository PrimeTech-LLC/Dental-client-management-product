#!/usr/bin/env node
/**
 * Database Migration & Seed Script
 * Usage: node scripts/migrate.js [--seed] [--reset]
 *
 *   --seed    Insert the minimum bootstrap data needed to run the app:
 *               • 3 receptionist accounts (Saad / Ather / Ali, password: dental123)
 *               • Blank clinic settings row (all fields empty — fill via Settings UI)
 *             No demo patients, doctors, appointments, or prescriptions are inserted.
 *
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
const args     = process.argv.slice(2);
const doSeed   = args.includes('--seed');
const doReset  = args.includes('--reset');

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
      console.log('ℹ️   Skipping seed (pass --seed to insert bootstrap data)');
      return;
    }

    // ── Check if already seeded ─────────────────────────────────
    const { rows: userRows } = await client.query(`SELECT id FROM users LIMIT 1`);
    if (userRows.length > 0) {
      console.log('ℹ️   Data already exists — skipping seed to avoid duplicates.');
      console.log('    Use --reset --seed to wipe and re-seed.');
      return;
    }

    console.log('🌱  Seeding bootstrap data...');
    await client.query('BEGIN');

    // ── Receptionist accounts ────────────────────────────────────
    // Passwords hashed with pgcrypto crypt() / blowfish.
    // Default password: dental123  — change after first login.
    await client.query(`
      INSERT INTO users (name, email, role, password_hash, is_active)
      VALUES
        ('Saad',  'saad@clinic.local',  'RECEPTIONIST', crypt('dental123', gen_salt('bf')), true),
        ('Ather', 'ather@clinic.local', 'RECEPTIONIST', crypt('dental123', gen_salt('bf')), true),
        ('Ali',   'ali@clinic.local',   'RECEPTIONIST', crypt('dental123', gen_salt('bf')), true)
    `);

    // ── Blank clinic settings (already inserted by schema DEFAULT row) ──
    // Ensure the default row exists in case schema hasn't inserted it yet:
    await client.query(`
      INSERT INTO clinic_settings (id) VALUES ('clinic-default')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('✅  Bootstrap seed complete.');
    console.log('   → 3 receptionist accounts: Saad / Ather / Ali (password: dental123)');
    console.log('   → Clinic settings row ready — fill in details via the Settings page.');
    console.log('   → No demo patients, doctors, or appointments inserted.');
    console.log('   → Add doctors and patients through the app UI.');

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

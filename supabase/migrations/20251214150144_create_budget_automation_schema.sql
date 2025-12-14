/*
  # Budget Automation System Schema

  1. New Tables
    - `services`
      - `id` (uuid, primary key)
      - `name` (text) - Service name (e.g., "Pintura de parede")
      - `base_price` (decimal) - Base price per unit
      - `unit` (text) - Unit of measurement (m², hora, etc.)
      - `created_at` (timestamptz)
    
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text) - Client name
      - `email` (text) - Client email
      - `phone` (text) - Client phone
      - `created_at` (timestamptz)
    
    - `budgets`
      - `id` (uuid, primary key)
      - `client_id` (uuid) - Reference to clients
      - `service_id` (uuid) - Reference to services
      - `quantity` (decimal) - Quantity of service
      - `distance_km` (decimal) - Distance to location
      - `difficulty_factor` (decimal) - 1.0 to 2.0 multiplier
      - `total_price` (decimal) - Calculated total price
      - `description` (text) - Additional details
      - `status` (text) - pending, sent, accepted, rejected
      - `sent_at` (timestamptz) - When email was sent
      - `created_at` (timestamptz)
    
    - `email_history`
      - `id` (uuid, primary key)
      - `budget_id` (uuid) - Reference to budgets
      - `type` (text) - proposal, response
      - `content` (text) - Email content
      - `sent_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
*/

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_price decimal(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'm²',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  quantity decimal(10,2) NOT NULL DEFAULT 0,
  distance_km decimal(10,2) NOT NULL DEFAULT 0,
  difficulty_factor decimal(3,2) NOT NULL DEFAULT 1.0,
  total_price decimal(10,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid REFERENCES budgets(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to services"
  ON services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update services"
  ON services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert budgets"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update budgets"
  ON budgets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete budgets"
  ON budgets FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Allow all access to email_history"
  ON email_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert email_history"
  ON email_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO services (name, base_price, unit) VALUES
  ('Pintura de parede interna', 25.00, 'm²'),
  ('Pintura de parede externa', 35.00, 'm²'),
  ('Instalação elétrica', 80.00, 'ponto'),
  ('Instalação hidráulica', 90.00, 'ponto'),
  ('Reboco', 45.00, 'm²'),
  ('Azulejo', 55.00, 'm²'),
  ('Gesso', 40.00, 'm²'),
  ('Piso', 50.00, 'm²')
ON CONFLICT DO NOTHING;
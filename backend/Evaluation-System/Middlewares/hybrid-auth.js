import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here'; // Updated to match Token-System

export default function createHybridAuthMiddleware(db) {
  return {
    register: async (req, res) => {
      try {
        const { email, password, name } = req.body;

        // Check if user already exists
        const existingUser = await db.pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (existingUser.rows.length > 0) {
          return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await db.pool.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
          [email, hashedPassword, name]
        );

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
      }
    },

    login: async (req, res) => {
      try {
        const { email, password } = req.body;

        // Get user
        const result = await db.pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        const user = result.rows[0];

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
          { 
            id: user.id, 
            email: user.email, 
            name: user.name,
            system: 'evaluation' // Specify this token is for evaluation system
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
      }
    }
  };
} 
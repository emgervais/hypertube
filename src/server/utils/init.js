import bcrypt from 'bcrypt';
import { SALT_ROUNDS } from './config.js';

export default async function createAdmin(db) {
  try {
    const users = db.collection('users');

    const password = process.env.ADMIN_PASSWORD;
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await users.insertOne({
        username: 'admin123',
        password: hash,
        name: 'a',
        surname: 'b',
        language: 'en',
        resetToken: null,
        resetExpire: null,
        isOauth: false,
        isAdmin: true,
        email: 'admin@example.com',
        watchedMovie: []
    });
  } catch(e) {
    console.log(e);
  }
}
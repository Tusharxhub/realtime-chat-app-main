
import { Router } from 'express';
const router = Router();

import { getUserDetails, verifyPassword } from './user-manager.js';
import { getNewToken } from '../common/token-manager.js';
import auth from '../common/auth.js';

router.post('/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username) return res.status(400).send('Invalid username');
    if (!password) return res.status(400).send('Invalid password');

    // username = username.trim().toLowerCase();
    
    const userDetails = await getUserDetails(username);
    if (!userDetails)
      return res.status(404).send('Incorrect username');

    if (!await verifyPassword(username, password))
      return res.status(401).send('Incorrect password');

    const token = await getNewToken(username);
    res.cookie('token', token, {
      // httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 60 * 60 * 1000 // ms
    })

    res.send(userDetails);
  } catch (err) {
    console.log('ERROR: While login', err);
    res.status(500).send('Server error');
  }
});

router.post('/logout', auth, (req, res) => {
  res.cookie('token', '', {
    expires: new Date(0)
  });
  res.send('Logged out successfully');
})

export default {
  router
}
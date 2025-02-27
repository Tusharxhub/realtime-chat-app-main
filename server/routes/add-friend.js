import express from 'express';
import auth from '../common/auth';
import { getUserDetails, addFriend } from './user-manager';
const router = express.Router();

router.post('/add-friend', auth, async (req, res) => {
  try {
    const friendName = req.body.friendName?.trim();
    if (!friendName) return res.status(400).send('Invalid friend name');

    const username = req.credentials.username;
    if (username === friendName) return res.status(400).send(`Can't add yourself as a friend`);

    const userDetails = await getUserDetails(username);
    if (userDetails.friends.includes(friendName.toLowerCase())) return res.status(400).send('Already in friend\'s list');

    const friendDetails = await getUserDetails(friendName);
    if (!friendDetails) return res.status(404).send(`No person with name "${friendName}" exists`);

    const added = await addFriend(userDetails.username, friendDetails.username);
    if (!added) return res.status(500).send('Something went wrong');

    res.send('Friend added');
  } catch (err) {
    console.log('ERROR (add-friend.js)', err);
    res.status(500).send('Something went wrong');
  }
});

export default router;
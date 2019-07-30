const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const shortid = require('shortid');
const moment = require('moment');
const dotenv = require('dotenv').config();

const app = express();
const db = process.env.MONGO_URI;

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

(async () => await mongoose.connect(db, { useNewUrlParser: true }))();

// === MODEL & SCHEMA === \\
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  userId: { type: String, required: true },
  count: { type: Number, default: 0 },
  log: [
    {
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: Date
    }
  ]
});

const User = mongoose.model('User', userSchema);

// === POST REQUEST === \\
app.post('/api/exercise/new-user', async (req, res) => {
  await User.findOne({ username: req.body.username }, (err, user) => {
    if (err) throw err;

    if (req.body.username === '')
      return res.json('Please enter a valid username.');

    if (!user) {
      user = new User({
        username: req.body.username,
        userId: shortid.generate()
      });

      user.save();

      res.json({ username: user.username, id: user.userId });
    } else {
      if (user) res.json('Username already taken...');
    }
  });
});

// === POST REQ ADD === \\
app.post('/api/exercise/add', async (req, res) => {
  await User.findOne({ userId: req.body.userId }, (err, user) => {
    if (!user) return res.json({ msg: 'No user found...' });

    let isValid = [];

    if (!req.body.description) isValid.push('Description');
    if (!req.body.duration) isValid.push('Duration');
    if (isValid.length > 0) return res.json({ Missing: isValid });

    let date = new Date(req.body.date);
    const isDate = date instanceof Date && !isNaN(date);

    isValid = [];
    if (req.body.description.length > 48)
      isValid.push('Description is too long');
    if (!/^\d+$/g.test(req.body.duration))
      isValid.push('Duration should be number only');
    if (req.body.date !== '' && !isDate) isValid.push('Date entry is invalid');

    if (isValid.length > 0) return res.json({ Error: isValid });

    user.count++;

    date = req.body.date || new Date();

    user.log.push({
      description: req.body.description,
      duration: req.body.duration,
      date
    });

    const add = {
      username: user.username,
      id: user.userId,
      description: req.body.description,
      duration: req.body.duration,
      date: moment(date).format('MMM Do YYYY dddd')
    };

    res.json(add);
    user.save();
  });
});

// === GET REQUEST === \\
app.get('/api/exercise/log', async (req, res) => {
  const { userId, from, to, limit } = req.query;

  await User.findOne({ userId }, (err, user) => {
    if (!user) return res.json('Not user with that ID is found.');

    let sortedDate = user.log.sort(
      (a, b) => Date.parse(a.date) > Date.parse(b.date)
    );

    if (from !== undefined) {
      const date = new Date(from);
      sortedDate = sortedDate.filter(d => d.date >= date);
    }

    if (to !== undefined) {
      const date = new Date(to);
      sortedDate = sortedDate.filter(d => d.date <= date);
    }

    if (limit > 0) sortedDate.length = limit;

    let newLog = sortedDate.map(x => {
      const newX = {
        description: x.description,
        duration: x.duration,
        date: moment(x.date).format('MMM Do YYYY dddd')
      };
      return newX;
    });

    const result = {
      username: user.username,
      id: userId,
      count: newLog.length,
      log: newLog
    };

    res.json(result);
  });
});

// =====================================================\\
// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res
    .status(errCode)
    .type('txt')
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});

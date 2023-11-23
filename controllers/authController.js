const authService = require('../services/authService');

exports.dummyFunction = async (req, res) => {
  try {
    console.log("at the controller");
    const users = await authService.dummyFunction();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
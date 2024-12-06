const bcrypt = require("bcryptjs");

// Function to generate a random 6-digit ID and hash it using bcrypt
exports.generateAuthToken = async () => {
    const randomId = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10); // Generate a salt
    const hashedId = await bcrypt.hash(randomId, salt); // Hash the random ID
    return { randomId, hashedId };
}

// Function to verify if a given random ID matches the hashed ID
exports.verifyAuthToken = async (randomId, hashedId) => {
    return await bcrypt.compare(randomId, hashedId); // Compare the ID with the hash
}
const jwt = require('jsonwebtoken');
const SECRET_KEY = '025db20932eb1289fe0bf5543df7c7969c23d2076f892456b997bd819884e32f';

function generateToken(payload) {
    const options = { expiresIn: '30m' };
    return jwt.sign(payload, SECRET_KEY, options);
}

function validateToken(token) {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (error) {
        return null;
    }
}

module.exports = {
    generateToken,
    validateToken
};

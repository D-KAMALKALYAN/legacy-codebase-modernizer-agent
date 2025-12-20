const jwt = require('jsonwebtoken');


/**
 * Generate JWT token
 */

const generateToken = (userId) => {
    return jwt.sign(
        {id : userId},
        process.env.JWT_SECRET,
        {expiresIn : process.env.JWT_EXPIRES_IN || '7d'}
    )
}

/**
 * Verify JWT token
 */

const verifyToken = (token) => {
    try{
        return jwt.verify(token, process.env.JWT_SECRET);
    }catch(error){
        return null;
    }
}

module.exports = {generateToken , verifyToken};

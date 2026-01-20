const {verifyToken} = require("../utils/jwt");
const User = require("../models/User");

const protect = async (req , res , next) => {
     let token;

      // Check for token in Authorization header
     if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
     }
     

     if(!token){
        return res.status(401).json({
            success : false,
            message : 'Not authorized to access this route'
        })
     }

     try{
        const decoded = verifyToken(token);
        if(!decoded){
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            })
        }

        const user = await User.findById(decoded.id).select('-password');
        if(!user){
            return res.status(404).json({
                success : false,
                message : 'User not found'
            });
        }

        req.user = user;
        next();
     }catch(error){

        return res.status(401).json({
            success : false,
            message : 'Not authorized to access this route'
        })  
    }
}



module.exports = { protect };
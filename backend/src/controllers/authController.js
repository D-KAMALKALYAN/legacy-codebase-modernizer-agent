const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */

const register = async(req , res) => {
    try{
        const { name , email , password } = req.body;

        if(!name || !email || !password){
            return res.status(400).json({
                success : false,
                message : "Please provide name, email, and password"
            });
        }


        if(password.length < 6){
            return res.status(400).json({
                success : false,
                message : "Password must be at least 6 characters"
            });
        }

        //check if user already exists
        const existingUser = await User.findOne({email});

        if(existingUser){
            return res.status(400).json({
                success: false,
                message : "User with this email already exists"
            });
        }

        const user = await User.create({
            name,
            email,
            password,
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success : true,
            message : "User registered successfully",
            data : {
                user : {
                    id : user._id,
                    name : user.name,
                    email : user.email
                },
                token
            }
        });

    }catch(error){
        console.error('Register error:' , error);
        res.status(500).json({
            success: false,
            message : "Server error during registration"
        });
    }
};


/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */

const login = async (req , res) => {
    try{
        const {email , password} = req.body;

        if(!email || ! password){
            return res.status(400).json({
                success : false,
                message : 'Please provide email and password'
            });
        }

        const user = await User.findOne({email}).select('+password');

        if(!user){
            return res.status(401).json({
                success : false,
                message : 'Please provide email and password'
            });
        }


        const isMatch = await user.comparePassword(password);
        if(!isMatch){
            return res.status(401).json({
                success : false,
                message : 'Invalid credentials'
            });
        }


        const token = generateToken(user._id);

        res.status(200).json({
            success : true,
            message : 'Login successful',
            data : {
                user : {
                    id : user._id,
                    name : user.name,
                    email : user.email
                },
                token
            }
        });


    }catch(error){
        console.error('Login error:' , error);
        res.status(500).json({
            success : false,
            message : "Server error during login"
        });
    }
};


/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */

const getMe = async (req , res) => {

    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({
            success : true,
            data : {
                user : {
                    id : user._id,
                    name : user.name,
                    email : user.email,
                    createdAt : user.createdAt
                }   
            }
        });
    }catch(error){
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user'
        });
    }
};

module.exports = {
  register,
  login,
  getMe
};
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    email : {
        type : String,
        required : [true , 'Email is required'],
        unique : true,
        lowercase : true,
        trim : true,
        match : [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },

    password : {
        type : String,
        required : [true , 'Password is required'],
        minlength : 6,
        select : false
    },

    name : {
        type : String ,
        required : [true , 'Name is required'],
        trim : true
    },

    createdAt : {
        type : Date,
        default : Date.now
    }
})

/* 🔐 Hash password before saving */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;  // ✅ Just return, no next()

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // ✅ No next() call needed
})

/* 🔑 Compare entered password with hashed password */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
}

const User = mongoose.model("User" , userSchema);

module.exports = User;
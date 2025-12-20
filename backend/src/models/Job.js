const mongoose = require("mongoose");

const jobSchema = mongoose.Schema({
userId : {
    type : mongoose.Schema.Types.ObjectId,
    ref : 'User',
    required : true
},
uploadType : {
    type : String,
    enum : ['snippet' , 'folder' , 'zip'],
    required : true
},
fileName : {
    type : String,
    required : true
},
filePath : {
    type : String,
    required : true
},
fileSize : {
    type : String,
    required : true
},
status : {
    type : String,
    enum : ['pending' , 'processing' , 'completed' , 'failed'],
    default : 'pending'
},
folderStructure : {
    type : Object,
    default : null
},

reportPath : {
    type : String,
    default : null
},

errorMessage : {
    type : String,
    default : null
},

metadata : {
    fileCount : {type : Number , default : 0},
    totalLines : {type : Number , default : 0},
    languages : [String]
},

createAt : {
    type : Date,
    default : Date.now
},

completedAt : {
    type : Date,
    default : null
}
});

const Job = mongoose.model("Job" , jobSchema);
module.exports = Job;
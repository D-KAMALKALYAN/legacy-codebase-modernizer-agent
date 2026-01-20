const fs = require("fs").promises;
const path = require("path");
const AdmZip = require("adm-zip");


/**
 * Validate file size
 */

const validateFileSize = (fileSize) => {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024; //converting MB to Bytes
    return fileSize <= maxSize;
}

/**
 * Validate file type
 */

const validateFileType = (fileName) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || '.js/.ts,.py,.java,.go,.rb,.php,.cs').split(',');
    const ext = path.extname(fileName).toLowerCase();

    if(ext === '.zip') return true;
    return allowedTypes.includes(ext);
};

/**
 * Extract ZIP file
 */

const extractZip = async (zipPath, extractPath) => {
    try{
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath , true);
        return true;
    }catch(error){
        throw new Error(`Failed to extract ZIP: ${error.message}`);
    }
};

/**
 * Generate folder structure tree
 */

const generateFolderStructure = async(dirPath, maxDepth = 5, currentDepth = 0) => {
    if(currentDepth >= maxDepth){
        return {name : '...' , type : 'turncated'};
    }

    try {
        const stats = await fs.stat(dirPath);
        const name = path.basename(dirPath);

        if(stats.isFile()){
            return {
                name,
                type : 'file',
                size : stats.size,
                extension : path.extname(name)
            };
        }

        if(stats.isDirectory()){
            const children = await fs.readdir(dirPath);
            const childNodes = await Promise.all(
                children  
                    .filter(child => !child.startsWith('.')) //Ignore hidden files
                    .map(child => generateFolderStructure(path.join(dirPath, child) , maxDepth, currentDepth + 1))  
            );

            return {
                name,
                type : 'directory',
                children : childNodes
            };
        }
    } catch (error) {
        return {
            name : path.basename(dirPath),
            type : 'error',
            message : error.message
        };
    }
};

/**
 * Count files and lines in directory
 */


const analyzeDirectory = async(dirPath) => {
    let fileCount = 0;
    let totalLines = 0;

    const lanugages = new Set();

    const traverse = async (currentPath) => {
        const stats = await fs.stat(currentPath);

        if(stats.isFile()){
            const ext = path.extname(currentPath).toLowerCase();

            if(ext && ext !== '.zip'){
                fileCount++;
                lanugages.add(ext);

                try{
                    const content = await fs.readFile(currentPath, 'utf-8');
                    totalLines += content.split('\n').length;
                }catch(error){
                    //Skip binary files
                }
            }
        }else if(stats.isDirectory()){
            const children = await fs.readdir(currentPath);
            for(const child of children){
                if(!child.startsWith('.')){
                    await traverse(path.join(currentPath , child));
                }
            }
        }
    };


    await traverse(dirPath);

    return {
        fileCount,
        totalLines,
        lanugages: Array.from(lanugages)
    };
};

/**
 * Save text snippet to file
 */
const saveSnippet = async(content, fileName, uploadDir) => {
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, content, 'utf-8');

    return filePath;
};

module.exports = {
    validateFileSize,
    validateFileType,
    extractZip,
    generateFolderStructure,
    analyzeDirectory,
    saveSnippet
}
// load module and settings
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const moment = require('moment');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});
const util = require('util');
const { resolve } = require('path');

// global variable init
const contents_frame = fs.readFileSync(path.resolve(__dirname, 'frame.php'),'utf-8');
const tab = '            ';
let dbHostname = '';
let dbPort = 3306;
let dbUser = '';
let dbPassword = '';
let dbDatabase = '';
let connection = null;
const question = util.promisify(readline.question).bind(readline);

// input db info
const dbVarInit = async () => {
    dbHostname = await question('database hostname : ');
    dbPort = await question('database port : ');
    dbUser = await question('database user : ');
    dbPassword = await question('database password : ');
    dbDatabase = await question('database database name : ');

    readline.close();
};

// db connect
const dbConnect = () => {
    return new Promise((resolve, reject) => {
        connection = mysql.createConnection({
            host     : dbHostname,
            port     : parseInt(dbPort),
            user     : dbUser,
            password : dbPassword,
            database : dbDatabase
        });
        connection.connect();
        resolve(true);
    })
}

// db dis connect
const dbDisConnect = () => {
    console.log('database connection disconnet...');
    connection.end();
}

// db query excute
const dbQuery = (query) => {
    return new Promise((resolve, reject) => {
        connection.query(query, 
            (error, results, fields) => {
                if (error){
                    dbDisConnect();
                    reject(false);
                    throw error;
                }
        
                resolve(results);
            }
        );
    });
}

// make laravel migration query
const makeMigrationQuery = async (tableName) => {
    let tempStr = '\n';
    let columns = await dbQuery('SHOW FULL COLUMNS FROM `'+ tableName +'`;');

    return new Promise((resolve, reject) => {
        for(column of columns){
            let name = column['Field'];
            let type = column['Type'];
            let type_len = '';
            let nullable = '';
            let col_default = '';
            let col_key = column['Key'];
            let type_add_val = '';
    
            //validate key
            if(col_key == 'PRI'){
                tempStr += tab + `$table->id('${name}');\n`;
                continue;
            }
    
            //validate data type
            if(type.indexOf('(') > -1){
                let type_split = type.split('(');
                type = type_split[0];
                tmp_type_val = type_split[1].split(')')[0].toString();
                type_len = '->length(' + tmp_type_val + ')';
                
                if(type == 'enum'){
                    type_add_val = ',[' + tmp_type_val + ']';
                    type_len = '';
                }
            }
            if(type == 'tinyint'){
                type = 'tinyInteger';
            }else if(type == 'int'){
                type = 'integer';
            }else if(type == 'bigint'){
                type = 'bigInteger';
            }else if(type == 'char'){
                type = 'char';
            }else if(type == 'varchar'){
                type = 'string';
            }else if(type == 'date'){
                type = 'date';
            }else if(type == 'datetime'){
                type = 'dateTime';
            }else if(type == 'mediumtext'){
                type = 'mediumText';
            }else if(type == 'enum'){
                type = 'enum';
            }
    
            // check nullbase
            if(column['Null'] == 'YES'){
                nullable = '->nullable()';
            }
    
            // validate default value
            if( column['Null'] == 'YES' && column['Default'] != '' && (column['Default'] == null || column['Default'].toString().length > 0) ){
                if(column['Default'] == null){
                    col_default = `->default(NULL)`;
                }else{
                    col_default = `->default('${column['Default'].replaceAll('\'','\\\'')}')`;
                }
                
            }
            
            tempStr += tab + `$table->${type}('${name}'${type_add_val})${type_len}${nullable}${col_default};\n`;
        }

        resolve(tempStr);
    });

}

// make migration file(*.php)
const makeMigrationFile = (tableName, columnQuery) => {
    return new Promise((resolve, reject) => {
        try {
            let fileName = moment().format('YYYY_MM_DD_hhmmss') + '_create_' + tableName + '_table.php';
            let contents = contents_frame.replaceAll('$$add_column$$', columnQuery).replaceAll('$$table_name$$',tableName);
            fs.writeFileSync(path.resolve(__dirname, fileName), contents);
            resolve(true);
        } catch (err) {
            console.error(err);
            reject(false);
        }
    })
}

// make query & migration file wrapper function
const makeMigrationStart = async (table) => {
    let migrationQuery = await makeMigrationQuery(table['Name']);
    await makeMigrationFile(table['Name'], migrationQuery);
}

// wrapper function
const makeMigration = async () => {
    let str = '';
    let tableList = await dbQuery('SHOW TABLE STATUS;');
    for(table of tableList){
        makeMigrationStart(table);
    }
}

// this project main code
const main = async () => {
    await dbVarInit();
    await dbConnect();
    await makeMigration();
    dbDisConnect();
}
main();
// load module and init project
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
const question = util.promisify(readline.question).bind(readline);
async function readInput(quest) {
    try {
        const answer = await question(quest);
        return answer;
    } catch (err) {
        console.error('Question rejected', err);
    }
}

const contents_frame = fs.readFileSync(path.resolve(__dirname, 'frame.php'),'utf-8');
const tab = '            ';
let dbHostname = '';
let dbUser = '';
let dbPassword = '';
let dbDatabase = '';
let connection = null;

const dbInit = async () => {
    dbHostname = await readInput('database hostname : ');
    dbUser = await readInput('database user : ');
    dbPassword = await readInput('database password : ');
    dbDatabase = await readInput('database database name : ');

    readline.close();
};

const dbConnect = async () => {
    connection = mysql.createConnection({
        host     : dbHostname,
        port     : 3306,
        user     : dbUser,
        password : dbPassword,
        database : dbDatabase
    });
    connection.connect();
}

const dbDisConnect = async () => {
    console.log('connection disconnet...');
    connection.end();
}

const makeMigrationFile = (table_name, add_column) => {
    return new Promise((resolve, reject) => {
        try {
            let fileName = moment().format('YYYY_MM_DD_hhmmss') + '_create_' + table_name + '_table.php';
            let contents = contents_frame.replaceAll('$$add_column$$',add_column).replaceAll('$$table_name$$',table_name);
            fs.writeFileSync(path.resolve(__dirname, fileName), contents);
            resolve(true);
        } catch (err) {
            console.error(err);
            reject(false);
        }
    })
}

const readTableList = (tables) => {
    return new Promise((resolve, reject) => {
        resolve(tables);
    });
}

const readColumnList = (tables) => {
    let str = '';
    return new Promise((resolve, reject) => {
        for(table of tables){
            let tableName = table['Name'];

            str = '\n';
            dbQuery('SHOW FULL COLUMNS FROM `'+ tableName +'`;').then((columns) => {
                for(column of columns){
                    let name = column['Field'];
                    let type = column['Type'];
                    let type_len = '';
                    let nullable = '';
                    let col_default = '';
                    let col_key = column['Key'];

                    if(col_key == 'PRI'){
                        str += tab + `$table->id('${name}');\n`;
                        continue;
                    }

                    if(type.indexOf('(') > -1){
                        let type_split = type.split('(');
                        type = type_split[0];
                        type_len = ', ' + type_split[1].split(')')[0].toString();
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

                    if(column['Null'] == 'YES'){
                        nullable = '->nullable()';
                    }

                    if(column['Default'] != null && typeof(column['Default']) != 'number'){
                        if(column['Default'].trim().length > 0){
                            col_default = `->default('${column['Default'].replaceAll('\'','\\\'')}')`;
                        }
                    }else{
                        col_default = `->default(${column['Default']})`;
                    }
                    
                    str += tab + `$table->${type}('${name}'${type_len})${nullable}${col_default};\n`;
                }

                makeMigrationFile(tableName, str).then(() => {
                    str = '\n';
                });
            });

            
        }
        
        resolve(true);
    })
}


const dbQuery = (query) => {
    console.log('dbQuery..');
    return new Promise((resolve, reject) => {
        connection.query(query, 
            (error, results, fields) => {
                if (error){
                    throw error;
                }
        
                resolve(results);
            }
        );
    });
}


const main = async () => {
    // input db config
    await dbInit();

    // read database
    await dbConnect();
    let tableList = await readTableList(await dbQuery('SHOW TABLE STATUS;'));
    await readColumnList(tableList);
    await dbDisConnect();
}
main();
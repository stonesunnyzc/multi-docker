const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');


const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres CLient App setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});
pgClient.on('error',() =>  console.log('Lost PG connection'));

pgClient.on('connect',() => {
    pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
        .catch(err => console.log(err));
});

//Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy : () => 1000
});
//这里我们在各个文件里使用重复的连接，是因为根据redis的文档，这个JS lib，如果我们有一个客户端在对redis做监听或者发布信息，
//我们必须创一个重复的连接，因为当一个连接变成了一个即将去监听、订阅或者发布信息的连接，它将不能再有其他用途了。
const redisPublisher = redisClient.duplicate();

//Express route handler
app.get('/',(req,res) => {
    res.send('Hi');
});

app.get('/values/all', async (req,res) =>{
    const values = await pgClient.query('SELECT * from values');
    res.send(values.rows);
});

app.get('/values/current', async (req,res) => {
    console.log("I am getting current request! recieved")
    redisClient.hgetall('values',(err,values) => {
        res.send(values);
    });
});

app.post('/values', async(req,res) => {
    const index = req.body.index;

    if(parseInt(index) > 40 ){
        return res.status(422).send('Index too hight');
    }

    redisClient.hset('values',index,'Nothing yet!');
    redisPublisher.publish('insert',index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({working:true});
});

app.listen(5000,(err) => {
    console.log('Listening');
})
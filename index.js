const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6wmoia0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db("summerBD").collection("users");
        const classesCollection = client.db("summerBD").collection("classes");
        const cartsCollection = client.db("summerBD").collection("carts");
        const paymentCollection = client.db("summerBD").collection("payments");

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }


        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user)
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.get('/users/:email',verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const result = await usersCollection.find({email: email}).toArray()
            res.send(result)
        })

        app.get('/instructors', async (req, res) => {
            const cursor = usersCollection.find({ role: "instructor" })
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/myclasses/:email', verifyJWT, verifyInstructor, async (req, res) => {
            // instructoremail
            console.log(req.params.email)
            const cursor = classesCollection.find({ instructoremail: req.params.email })
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post('/classes', verifyJWT, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass);
            res.send(result)

        })

        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        app.get('/approveclasses', async (req, res) => {
            const cursor = classesCollection.find({ status: "approve" })
            const result = await cursor.toArray()
            res.send(result);
        })


        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const { } = req.body
            console.log(id)
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)

        })

        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log('137', email)
            if (req.decoded.email !== email) {
              return  res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            // console.log(result)
            res.send(result);
        })

        app.get('/users/instructors/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log('150', email)
            if (req.decoded.email !== email) {
              return  res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            // console.log(result)
            res.send(result);
        })

        app.get('/users/student/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log('150', email)
            if (req.decoded.email !== email) {
               return res.send({ student: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { student: user?.role === 'student' }
            // console.log(result)
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const { } = req.body
            console.log(id)
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)

        })


        app.put('/updatestatus/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const { classname, imgURL, instructorname, instructoremail, availableseats, price, TotalEnrolled, status } = req.body;
            const filter = { _id: new ObjectId(id) };
            console.log(filter)
            const updatetoy = {
                $set: {
                    imgURL: imgURL,
                    classname: classname,
                    instructorname: instructorname,
                    instructoremail: instructoremail,
                    availableseats: availableseats,
                    price: price,
                    status: status,
                    TotalEnrolled: TotalEnrolled
                }
            }
            const result = await classesCollection.updateOne(filter, updatetoy)

            res.send(result)
        })

        app.patch('/feedback/:id',verifyJWT, async(req, res) =>{
            const id = req.params.id;
            const {feedBack} = req.body;

            const filter = {_id: new ObjectId(id)};
            const updateDoc = {
                $set: {
                    feedback: feedBack
                }
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result)

        })

        app.post('/addclass', async (req, res) => {
            const selectClasses = req.body
            const result = await cartsCollection.insertOne(selectClasses);
            res.send(result)
        })

        app.get('/addclass/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const result = await cartsCollection.find({ email: email }).toArray();
            res.send(result)
        })

        app.get('/getclass/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const result = await cartsCollection.find({ _id: new ObjectId(id) }).toArray()
            res.send(result);
        })

        app.delete('/deleteitem/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) };
            const result = await cartsCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/enrolledClasses', verifyJWT, async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result)
        })

        // create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            console.log(price)
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })


        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment)


            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
            console.log(query)
            const deleteResult = await cartsCollection.deleteOne(query)

            const { itemNames, imgURL, price, availableseats, TotalEnrolled,instructoremail,instructorname,status } = payment;
            // console.log(itemNames,price,imgURL, price, availableseats, TotalEnrolled, instructoremail,instructorname,status)
            const id = payment.menuItems
            const filter = { _id: new ObjectId(id) };
            const updatetoy = {
                $set: {
                    imgURL: imgURL,
                    classname: itemNames,
                    instructorname: instructorname,
                    price: price,
                    instructoremail: instructoremail,
                    availableseats: availableseats,
                    status: status,
                    TotalEnrolled: TotalEnrolled
                }
            }
            const  result = await classesCollection.updateOne(filter, updatetoy)
            res.send({insertResult, deleteResult,result})
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('Summer is start')
})

app.listen(port, () => {
    console.log(`Summer is sitting on port ${port}`);
})
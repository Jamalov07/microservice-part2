import * as express from "express";
import * as cors from "cors";
import { Request, Response } from "express";
import AppDataSource from "../ormconfig";
import * as amqp from "amqplib/callback_api";
import { Product } from "./entity/product";
import axios from "axios";
import { ObjectId } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();

AppDataSource.initialize()
    .then((db) => {
        const productRepository = db.getRepository(Product);
        amqp.connect(process.env.AMQP, (error0, connection) => {
            if (error0) {
                throw error0;
            }
            connection.createChannel((error1, channel) => {
                if (error1) {
                    throw error1;
                }
                channel.assertQueue("product_created", { durable: false });
                channel.assertQueue("product_updated", { durable: false });
                channel.assertQueue("product_deleted", { durable: false });

                const app = express();
                console.log("MongoDB connected!");
                app.use(cors());
                app.use(express.json());

                channel.consume(
                    "product_created",
                    async (msg) => {
                        const eventProduct = JSON.parse(msg.content.toString());
                        const product = new Product();
                        product.pg_id = parseInt(eventProduct.id);
                        product.title = eventProduct.title;
                        product.image = eventProduct.image;
                        product.likes = eventProduct.likes;
                        await productRepository.save(product);
                        console.log("product created");
                    },
                    { noAck: true }
                );

                channel.consume(
                    "product_updated",
                    async (msg) => {
                        const eventProduct = JSON.parse(msg.content.toString());
                        const product = await productRepository.findOneBy({ pg_id: +eventProduct.id });
                        productRepository.merge(product, {
                            title: eventProduct.title,
                            image: eventProduct.image,
                            likes: eventProduct.likes,
                        });
                        await productRepository.save(product);
                        console.log("product updated");
                    },
                    { noAck: true }
                );

                channel.consume(
                    "product_deleted",
                    async (msg) => {
                        const pgId: Partial<Product> = JSON.parse(msg.content.toString());
                        const product = await productRepository.delete({ pg_id: +pgId });
                        console.log("product updated");
                    },
                    { noAck: true }
                );

                app.get("/product", async (req: Request, res: Response) => {
                    const products = await productRepository.find();
                    res.send(products);
                });

                app.get("/product/:id", async (req: Request, res: Response) => {
                    const product = await productRepository.findOneBy({ _id: new ObjectId(req.params.id) });
                    res.json(product);
                });

                app.post("/product/:id/like", async (req: Request, res: Response) => {
                    const product = await productRepository.findOneBy({ _id: new ObjectId(req.params.id) });
                    await axios.post(`http://localhost:3000/product/${product.pg_id}/like`);
                    product.likes++;
                    await productRepository.save(product);
                    res.send(product);
                });

                app.listen(3001, () => {
                    console.log("Server listening on port 3001!");
                });

                process.on("beforeExit", () => {
                    console.log("closing");
                    connection.close();
                });
            });
        });
    })
    .catch((error) => console.log(error));

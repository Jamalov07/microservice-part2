import { Column, Entity, ObjectId, ObjectIdColumn } from "typeorm";

@Entity()
export class Product {
    @ObjectIdColumn()
    _id: ObjectId;

    @Column({ unique: true })
    pg_id: number;

    @Column({ type: String })
    title: string;

    @Column({ type: String })
    image: string;

    @Column({ default: 0 })
    likes: number;
}

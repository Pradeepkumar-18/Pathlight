import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column()
  total!: number;

  @Column('real')
  discount!: number;

  @Column()
  status!: string;
}

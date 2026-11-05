import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type Tier = 'gold' | 'silver' | 'bronze';

// `id: false` turns off Mongoose's `id` virtual so the numeric `id` field is
// the one queried, as in the PRD's `users.findOne({ id: 7 })`.
@Schema({ collection: 'users', id: false, versionKey: false })
export class User {
  @Prop({ required: true, unique: true })
  id!: number;

  @Prop({ required: true })
  name!: string;

  // Optional on purpose: old user documents have no tier, which is the bug.
  @Prop({ type: String })
  tier?: Tier;
}

export const UserSchema = SchemaFactory.createForClass(User);

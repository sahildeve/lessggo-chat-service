import redis from "../config/redis.js";

export const isRideMember = async (rideId, userId) => {
  const member = await redis.sismember(`ride_members:${rideId}`, userId);
  return member === 1;
};

export const assertRideMember = async (rideId, userId) => {
  const isMember = await isRideMember(rideId, userId);
  if (!isMember) {
    const err = new Error("You are not a member of this ride123");
    err.status = 403;
    throw err;
  }
};

import bcrypt from "bcrypt";

const password = "JPMendozaA2";
const saltRounds = 10;

const run = async () => {
  const hash = await bcrypt.hash(password, saltRounds);
  console.log("Generated hash:", hash);
};

run();

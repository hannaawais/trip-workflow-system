import bcrypt from 'bcrypt';

async function testHash() {
    const password = 'Aa123@456';
    const hash = await bcrypt.hash(password, 10);
    console.log('Password:', password);
    console.log('Generated hash:', hash);
    
    // Test the hash
    const isValid = await bcrypt.compare(password, hash);
    console.log('Hash validation:', isValid);
}

testHash();
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import ora from 'ora';
import { contractAddress } from "ton";
import { WalletV4Source } from "ton-contracts";
import { log, warn } from "./log";

function pathElementsToBuffer(paths: number[]): Buffer {
    const buffer = Buffer.alloc(1 + paths.length * 4);
    buffer[0] = paths.length;
    paths.forEach((element, index) => {
        buffer.writeUInt32BE(element, 1 + 4 * index);
    });
    return buffer;
}

(async () => {

    // Loading devices
    let spinner = ora('Searching for Ledger...');
    let devices = (await TransportNodeHid.list()) as string[];
    spinner.succeed();
    if (devices.length === 0) {
        warn('No Ledger device found');
        return;
    }
    spinner = ora('Connecting to device...');
    let dev = await TransportNodeHid.open(devices[0]);
    spinner.succeed();

    spinner = ora('Getting address');
    let response = await dev.send(0xE0, 0x05, 0x00, 0x00, pathElementsToBuffer([
        44 + 0x80000000,
        607 + 0x80000000,
        0 + 0x80000000,
        0 + 0x80000000
    ]));
    let publicKey = response.slice(0, 32);
    const contract = WalletV4Source.create({ workchain: 0, publicKey: publicKey });
    let address = contractAddress(contract);
    spinner.succeed('Address: ' + address.toFriendly());

    spinner = ora('Avaiting confirmation');
    let ok = false;
    try {
        await dev.send(0xE0, 0x05, 0x01, 0x00, pathElementsToBuffer([
            44 + 0x80000000,
            607 + 0x80000000,
            0 + 0x80000000,
            0 + 0x80000000
        ]));
        ok = true;
    } catch (e) {
        // Ignore
    }
    if (ok) {
        spinner.succeed('Address confirmed');
    } else {
        spinner.fail('Confirmation failed');
    }
})();
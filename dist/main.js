import fs from 'fs/promises';
var AttributeType;
(function (AttributeType) {
    AttributeType[AttributeType["STANDARD_INFORMATION"] = 16] = "STANDARD_INFORMATION";
    AttributeType[AttributeType["ATTRIBUTE_LIST"] = 32] = "ATTRIBUTE_LIST";
    AttributeType[AttributeType["FILE_NAME"] = 48] = "FILE_NAME";
    AttributeType[AttributeType["OBJECT_ID"] = 64] = "OBJECT_ID";
    AttributeType[AttributeType["SECURITY_DESCRIPTOR"] = 80] = "SECURITY_DESCRIPTOR";
    AttributeType[AttributeType["VOLUME_NAME"] = 96] = "VOLUME_NAME";
    AttributeType[AttributeType["VOLUME_INFORMATION"] = 112] = "VOLUME_INFORMATION";
    AttributeType[AttributeType["DATA"] = 128] = "DATA";
    AttributeType[AttributeType["INDEX_ROOT"] = 144] = "INDEX_ROOT";
    AttributeType[AttributeType["INDEX_ALLOCATION"] = 160] = "INDEX_ALLOCATION";
    AttributeType[AttributeType["BITMAP"] = 176] = "BITMAP";
    AttributeType[AttributeType["REPARSE_POINT"] = 192] = "REPARSE_POINT";
    AttributeType[AttributeType["EA_INFORMATION"] = 208] = "EA_INFORMATION";
    AttributeType[AttributeType["EA"] = 224] = "EA";
    AttributeType[AttributeType["LOGGED_UTILITY_STREAM"] = 256] = "LOGGED_UTILITY_STREAM";
    AttributeType[AttributeType["END"] = 4294967295] = "END";
})(AttributeType || (AttributeType = {}));
const PARTITION_BOOT_SECTOR_SIZE = 512;
const FILE_RECORD_SIZE = 1024;
const BASE_ATTRIBUTE_HEADER_MIN_LENGTH = 16;
const RESIDENT_ATTRIBUTE_HEADER_MIN_LENGTH = BASE_ATTRIBUTE_HEADER_MIN_LENGTH + 8;
const NON_RESIDENT_ATTRIBUTE_HEADER_MIN_LENGTH = BASE_ATTRIBUTE_HEADER_MIN_LENGTH + 48;
await main();
async function main() {
    const file = await fs.open('N:/jesslap/backup-nvme0n1p1.img');
    const partitionBootSectorBuffer = Buffer.alloc(PARTITION_BOOT_SECTOR_SIZE);
    await file.read(partitionBootSectorBuffer, 0, PARTITION_BOOT_SECTOR_SIZE, 0);
    const bootSector = parsePartitionBootSector(partitionBootSectorBuffer);
    console.log(bootSector);
    const mftFileRecordBuffer = Buffer.alloc(FILE_RECORD_SIZE);
    const mftStartByte = bootSector.extendedBpb.mftLogicalClusterNumber * BigInt(bootSector.bpb.sectorsPerCluster) * BigInt(bootSector.bpb.bytesPerSector);
    await file.read(mftFileRecordBuffer, 0, FILE_RECORD_SIZE, Number(mftStartByte));
    const mftFileRecord = parseFileRecord(mftFileRecordBuffer);
    console.dir(mftFileRecord, { depth: null });
    const dataAttribute = mftFileRecord.attributes.find(a => a.header.attributeType === AttributeType.DATA);
    if (dataAttribute === undefined) {
        throw new Error('No data attribute for MFT file');
    }
    if (!dataAttribute.header.nonResident) {
        throw new Error('Data attribute for MFT file is resident (this is unexpected)');
    }
    //dataAttribute.header.dataRunsOffset
}
function parsePartitionBootSector(buffer) {
    if (buffer.byteLength < PARTITION_BOOT_SECTOR_SIZE) {
        throw new Error(`Buffer is too short for partition boot sector (${buffer.byteLength} < ${{ PARTITION_BOOT_SECTOR_SIZE }})`);
    }
    let offset = 0;
    const bootSector = {};
    bootSector.jumpInstruction = buffer.readUintLE(offset, 3);
    offset += 3;
    bootSector.oemId = buffer.toString('ascii', offset, offset + 8);
    offset += 8;
    bootSector.bpb = {};
    bootSector.bpb.bytesPerSector = buffer.readUint16LE(offset);
    offset += 2;
    bootSector.bpb.sectorsPerCluster = buffer.readUint8(offset);
    offset += 1;
    bootSector.bpb.reservedSectors = buffer.readUint16LE(offset);
    offset += 2;
    bootSector.bpb.alwaysZero1 = buffer.readUintLE(offset, 3);
    offset += 3;
    bootSector.bpb.unused1 = buffer.readUint16LE(offset);
    offset += 2;
    bootSector.bpb.mediaDescripter = buffer.readUint8(offset);
    offset += 1;
    bootSector.bpb.alwaysZero2 = buffer.readUint16LE(offset);
    offset += 2;
    bootSector.bpb.sectorsPerTrack = buffer.readUint16LE(offset);
    offset += 2;
    bootSector.bpb.numberOfHeads = buffer.readUint16LE(offset);
    offset += 2;
    bootSector.bpb.hiddenSectors = buffer.readUint32LE(offset);
    offset += 4;
    bootSector.bpb.unused2 = buffer.readUint32LE(offset);
    offset += 4;
    bootSector.extendedBpb = {};
    bootSector.extendedBpb.unused1 = buffer.readUInt32LE(offset);
    offset += 4;
    bootSector.extendedBpb.totalSectors = buffer.readBigUInt64LE(offset);
    offset += 8;
    bootSector.extendedBpb.mftLogicalClusterNumber = buffer.readBigUint64LE(offset);
    offset += 8;
    bootSector.extendedBpb.mftMirrorLogicalClusterNumber = buffer.readBigUint64LE(offset);
    offset += 8;
    bootSector.extendedBpb.clustersPerFileRecordSegment = buffer.readUInt32LE(offset);
    offset += 4;
    bootSector.extendedBpb.clustersPerIndexBuffer = buffer.readUint8(offset);
    offset += 1;
    bootSector.extendedBpb.unused2 = buffer.readUintLE(offset, 3);
    offset += 3;
    bootSector.extendedBpb.volumeSerialNumber = buffer.readBigUint64LE(offset);
    offset += 8;
    bootSector.extendedBpb.checksum = buffer.readUInt32LE(offset);
    offset += 4;
    bootSector.bootstrapCode = buffer.subarray(offset, offset + 426);
    offset += 426;
    bootSector.endOfSectorMarker = buffer.readUInt16LE(offset);
    offset += 2;
    return bootSector;
}
function parseFileRecord(buffer) {
    if (buffer.byteLength < FILE_RECORD_SIZE) {
        throw new Error(`Buffer is too short for file record (${buffer.byteLength} < ${{ FILE_RECORD_SIZE }})`);
    }
    const record = {};
    record.header = {};
    let offset = 0;
    record.header.magic = buffer.toString('ascii', 0, 4);
    offset += 4;
    record.header.updateSequenceOffset = buffer.readUint16LE(offset);
    offset += 2;
    record.header.updateSequenceSize = buffer.readUint16LE(offset);
    offset += 2;
    record.header.logSequence = buffer.readBigUint64LE(offset);
    offset += 8;
    record.header.sequenceNumber = buffer.readUint16LE(offset);
    offset += 2;
    record.header.hardLinkCount = buffer.readUint16LE(offset);
    offset += 2;
    record.header.firstAttributeOffset = buffer.readUint16LE(offset);
    offset += 2;
    record.header.flags = buffer.readUint16LE(offset);
    offset += 2;
    record.header.usedSize = buffer.readUInt32LE(offset);
    offset += 4;
    record.header.allocatedSize = buffer.readUInt32LE(offset);
    offset += 4;
    record.header.fileReference = buffer.readBigUInt64LE(offset);
    offset += 8;
    record.header.nextAttributeId = buffer.readUInt16LE(offset);
    offset += 2;
    record.header.unused = buffer.readUInt16LE(offset);
    offset += 2;
    record.header.recordNumber = buffer.readUint32LE(offset);
    offset += 4;
    record.attributes = [];
    console.log(offset);
    console.log(record.header.firstAttributeOffset);
    offset = record.header.firstAttributeOffset;
    while (true) {
        const attributeStartOffset = offset;
        console.log(offset);
        const attribute = {};
        const baseHeader = {};
        baseHeader.attributeType = buffer.readUInt32LE(offset);
        offset += 4;
        baseHeader.length = buffer.readUint32LE(offset);
        offset += 4;
        baseHeader.nonResident = buffer.readUint8(offset) > 0 ? true : false;
        offset += 1;
        baseHeader.nameLength = buffer.readUint8(offset);
        offset += 1;
        baseHeader.nameOffset = buffer.readUint16LE(offset);
        offset += 2;
        baseHeader.flags = buffer.readUint16LE(offset);
        offset += 2;
        baseHeader.attributeId = buffer.readUint16LE(offset);
        offset += 2;
        if (baseHeader.nonResident) {
            attribute.header = baseHeader;
            attribute.header.firstCluster = buffer.readBigInt64LE(offset);
            offset += 8;
            attribute.header.lastCluster = buffer.readBigInt64LE(offset);
            offset += 8;
            attribute.header.dataRunsOffset = buffer.readUInt16LE(offset);
            offset += 2;
            attribute.header.compressionUnit = buffer.readUInt16LE(offset);
            offset += 2;
            attribute.header.unused = buffer.readUInt32LE(offset);
            offset += 4;
            attribute.header.attributeAllocated = buffer.readBigUint64LE(offset);
            offset += 8;
            attribute.header.attributeSize = buffer.readBigUint64LE(offset);
            offset += 8;
            attribute.header.streamDataSize = buffer.readBigUint64LE(offset);
            offset += 8;
            attribute.header.dataRuns = [];
            // offset = attribute.header.dataRunsOffset;
            // while (offset < attribute.header.length) {
            //     const subBuffer = buffer.subarray(offset, offset + 17);
            //     if (subBuffer.readUint8(0) === 0) { // jank way of checking for an empty data run which apparently can indicate no more data runs (is this always the case?)
            //         break;
            //     }
            //     const dataRun: DataRun = {} as DataRun;
            //     const fullByte = buffer.readUint8(offset);                                     offset += 1;
            //     dataRun.lengthFieldLength = fullByte & 0x0F;
            //     dataRun.offsetFieldLength = (fullByte & 0xF0) >> 4;
            //     dataRun.length = BigInt(buffer.readUintLE(offset, dataRun.lengthFieldLength)); offset += dataRun.lengthFieldLength;
            //     dataRun.offset = BigInt(buffer.readUintLE(offset, dataRun.offsetFieldLength)); offset += dataRun.offsetFieldLength;
            //     attribute.header.dataRuns.push(dataRun);
            //     offset += 1 + dataRun.lengthFieldLength + dataRun.offsetFieldLength;
            // }
        }
        else {
            attribute.header = baseHeader;
            attribute.header.valueLength = buffer.readUint32LE(offset);
            offset += 4;
            attribute.header.valueOffset = buffer.readUint16LE(offset);
            offset += 2;
            attribute.header.indexed = buffer.readUint8(offset) > 0 ? true : false;
            offset += 1;
            attribute.header.unused = buffer.readUint8(offset);
            offset += 1;
        }
        record.attributes.push(attribute);
        if (attribute.header.attributeType === AttributeType.END) {
            break;
        }
        offset = attributeStartOffset + attribute.header.length;
    }
    return record;
}
//# sourceMappingURL=main.js.map
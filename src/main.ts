import fs from 'fs/promises';

enum AttributeType {
    STANDARD_INFORMATION  = 0x10,
    ATTRIBUTE_LIST        = 0x20,
    FILE_NAME             = 0x30,
    OBJECT_ID             = 0x40, // VOLUME_VERSION in NTFS 1.2
    SECURITY_DESCRIPTOR   = 0x50,
    VOLUME_NAME           = 0x60,
    VOLUME_INFORMATION    = 0x70,
    DATA                  = 0x80,
    INDEX_ROOT            = 0x90,
    INDEX_ALLOCATION      = 0xA0,
    BITMAP                = 0xB0,
    REPARSE_POINT         = 0xC0, // SYMBOLIC_LINK in NTFS 1.2
    EA_INFORMATION        = 0xD0,
    EA                    = 0xE0,
    LOGGED_UTILITY_STREAM = 0x100,
    END                   = 0xFFFFFFFF,
}

interface DataRun {
    lengthFieldLength: number; // The number of bytes used to make up `length`
    offsetFieldLength: number; // The number of bytes used to make up `offset`
    length: bigint;            // A variable-length field from 1 to 8 bytes
    offset: bigint;            // A variable-length field from 1 to 8 bytes
}

interface BPB {
    bytesPerSector: number;    // 2 bytes
    sectorsPerCluster: number; // 1 byte
    reservedSectors: number;   // 2 bytes
    alwaysZero1: number;       // 3 bytes
    unused1: number;           // 2 bytes
    mediaDescripter: number;   // 1 byte
    alwaysZero2: number;       // 2 bytes
    sectorsPerTrack: number;   // 2 bytes
    numberOfHeads: number;     // 2 bytes
    hiddenSectors: number;     // 4 bytes
    unused2: number;           // 4 bytes
}

interface ExtendedBPB {
    unused1: number;                       // 4 bytes
    totalSectors: bigint;                  // 8 bytes
    mftLogicalClusterNumber: bigint;       // 8 bytes
    mftMirrorLogicalClusterNumber: bigint; // 8 bytes
    clustersPerFileRecordSegment: number;  // 4 bytes
    clustersPerIndexBuffer: number;        // 1 byte
    unused2: number;                       // 3 bytes
    volumeSerialNumber: bigint;            // 8 bytes
    checksum: number;                      // 4 bytes
}

interface PartitionBootSector {
    jumpInstruction: number;   // 3 bytes
    oemId: string;             // 8 bytes
    bpb: BPB;                  // 25 bytes
    extendedBpb: ExtendedBPB;  // 48 bytes
    bootstrapCode: Buffer;     // 426 bytes
    endOfSectorMarker: number; // 2 bytes
}

interface FileRecordHeader {
    magic: string;                // 4 bytes, always FILE or BAAD
    updateSequenceOffset: number; // 2 bytes
    updateSequenceSize: number;   // 2 bytes
    logSequence: bigint;          // 8 bytes
    sequenceNumber: number;       // 2 bytes
    hardLinkCount: number;        // 2 bytes
    firstAttributeOffset: number; // 2 bytes, number of bytes between the start of the header and the first attribute header
    flags: number;                // 2 bytes
    usedSize: number;             // 4 bytes
    allocatedSize: number;        // 4 bytes
    fileReference: bigint;        // 8 bytes
    nextAttributeId: number;      // 2 bytes
    unused: number;               // 2 bytes
    recordNumber: number;         // 4 bytes
}

interface BaseAttributeHeader {
    attributeType: AttributeType;
    length: number;
    nonResident: boolean;
    nameLength: number;
    nameOffset: number;
    flags: number;
    attributeId: number;
}

interface ResidentAttributeHeader extends BaseAttributeHeader {
    nonResident: false;
    valueLength: number;
    valueOffset: number;
    indexed: boolean;
    unused: number;
}

interface NonResidentAttributeHeader extends BaseAttributeHeader {
    nonResident: true;
    firstCluster: bigint;
    lastCluster: bigint;
    dataRunsOffset: number;
    compressionUnit: number;
    unused: number;
    attributeAllocated: bigint;
    attributeSize: bigint;
    streamDataSize: bigint;
    dataRuns: DataRun[];
}

type AttributeHeader = ResidentAttributeHeader | NonResidentAttributeHeader;

interface Attribute {
    header: AttributeHeader;
    contents?: Buffer;
}

interface FileRecord {
    header: FileRecordHeader;
    attributes: Attribute[];
}

const PARTITION_BOOT_SECTOR_SIZE = 512;
const FILE_RECORD_SIZE = 1024;
const BASE_ATTRIBUTE_HEADER_MIN_LENGTH = 16;
const RESIDENT_ATTRIBUTE_HEADER_MIN_LENGTH = BASE_ATTRIBUTE_HEADER_MIN_LENGTH + 8;
const NON_RESIDENT_ATTRIBUTE_HEADER_MIN_LENGTH = BASE_ATTRIBUTE_HEADER_MIN_LENGTH + 48;

await main();

async function main(): Promise<void> {
    const file = await fs.open('N:/jesslap/backup-nvme0n1p1.img');
    
    const partitionBootSectorBuffer = Buffer.alloc(PARTITION_BOOT_SECTOR_SIZE);
    await file.read(partitionBootSectorBuffer, 0, PARTITION_BOOT_SECTOR_SIZE, 0);
    const bootSector = parsePartitionBootSector(partitionBootSectorBuffer);
    console.log(bootSector);
    
    const mftFileRecordBuffer = Buffer.alloc(FILE_RECORD_SIZE);
    const mftStartByte = bootSector.extendedBpb.mftLogicalClusterNumber * BigInt(bootSector.bpb.sectorsPerCluster) * BigInt(bootSector.bpb.bytesPerSector);
    await file.read(mftFileRecordBuffer, 0, FILE_RECORD_SIZE, Number(mftStartByte));
    const mftFileRecord = parseFileRecord(mftFileRecordBuffer);
    console.dir(mftFileRecord, {depth: null});
    
    const dataAttribute = mftFileRecord.attributes.find(a => a.header.attributeType === AttributeType.DATA);
    if (dataAttribute === undefined) {
        throw new Error('No data attribute for MFT file');
    }
    if (!dataAttribute.header.nonResident) {
        throw new Error('Data attribute for MFT file is resident (this is unexpected)');
    }
    
    //dataAttribute.header.dataRunsOffset
}

function parsePartitionBootSector(buffer: Buffer): PartitionBootSector {
    if (buffer.byteLength < PARTITION_BOOT_SECTOR_SIZE) {
        throw new Error(`Buffer is too short for partition boot sector (${buffer.byteLength} < ${{PARTITION_BOOT_SECTOR_SIZE}})`);
    }
    let offset = 0;
    const bootSector: PartitionBootSector = {} as PartitionBootSector;
    bootSector.jumpInstruction = buffer.readUintLE(offset, 3);                 offset += 3;
    bootSector.oemId           = buffer.toString('ascii', offset, offset + 8); offset += 8;
    bootSector.bpb = {} as BPB;
    bootSector.bpb.bytesPerSector    = buffer.readUint16LE(offset);  offset += 2;
    bootSector.bpb.sectorsPerCluster = buffer.readUint8(offset);     offset += 1;
    bootSector.bpb.reservedSectors   = buffer.readUint16LE(offset);  offset += 2;
    bootSector.bpb.alwaysZero1       = buffer.readUintLE(offset, 3); offset += 3;
    bootSector.bpb.unused1           = buffer.readUint16LE(offset);  offset += 2;
    bootSector.bpb.mediaDescripter   = buffer.readUint8(offset);     offset += 1;
    bootSector.bpb.alwaysZero2       = buffer.readUint16LE(offset);  offset += 2;
    bootSector.bpb.sectorsPerTrack   = buffer.readUint16LE(offset);  offset += 2;
    bootSector.bpb.numberOfHeads     = buffer.readUint16LE(offset);  offset += 2;
    bootSector.bpb.hiddenSectors     = buffer.readUint32LE(offset);  offset += 4;
    bootSector.bpb.unused2           = buffer.readUint32LE(offset);  offset += 4;
    bootSector.extendedBpb = {} as ExtendedBPB;
    bootSector.extendedBpb.unused1                       = buffer.readUInt32LE(offset);           offset += 4;
    bootSector.extendedBpb.totalSectors                  = buffer.readBigUInt64LE(offset);        offset += 8;
    bootSector.extendedBpb.mftLogicalClusterNumber       = buffer.readBigUint64LE(offset);        offset += 8;
    bootSector.extendedBpb.mftMirrorLogicalClusterNumber = buffer.readBigUint64LE(offset);        offset += 8;
    bootSector.extendedBpb.clustersPerFileRecordSegment  = buffer.readUInt32LE(offset);           offset += 4;
    bootSector.extendedBpb.clustersPerIndexBuffer        = buffer.readUint8(offset);              offset += 1;
    bootSector.extendedBpb.unused2                       = buffer.readUintLE(offset, 3);          offset += 3;
    bootSector.extendedBpb.volumeSerialNumber            = buffer.readBigUint64LE(offset);        offset += 8;
    bootSector.extendedBpb.checksum                      = buffer.readUInt32LE(offset);           offset += 4;
    bootSector.bootstrapCode                             = buffer.subarray(offset, offset + 426); offset += 426;
    bootSector.endOfSectorMarker                         = buffer.readUInt16LE(offset);           offset += 2;
    return bootSector;
}

function parseFileRecord(buffer: Buffer): FileRecord {
    if (buffer.byteLength < FILE_RECORD_SIZE) {
        throw new Error(`Buffer is too short for file record (${buffer.byteLength} < ${{FILE_RECORD_SIZE}})`);
    }
    const record: FileRecord = {} as FileRecord;
    record.header = {} as FileRecordHeader;
    let offset = 0;
    record.header.magic                = buffer.toString('ascii', 0, 4); offset += 4;
    record.header.updateSequenceOffset = buffer.readUint16LE(offset);    offset += 2;
    record.header.updateSequenceSize   = buffer.readUint16LE(offset);    offset += 2;
    record.header.logSequence          = buffer.readBigUint64LE(offset); offset += 8;
    record.header.sequenceNumber       = buffer.readUint16LE(offset);    offset += 2;
    record.header.hardLinkCount        = buffer.readUint16LE(offset);    offset += 2;
    record.header.firstAttributeOffset = buffer.readUint16LE(offset);    offset += 2;
    record.header.flags                = buffer.readUint16LE(offset);    offset += 2;
    record.header.usedSize             = buffer.readUInt32LE(offset);    offset += 4;
    record.header.allocatedSize        = buffer.readUInt32LE(offset);    offset += 4;
    record.header.fileReference        = buffer.readBigUInt64LE(offset); offset += 8;
    record.header.nextAttributeId      = buffer.readUInt16LE(offset);    offset += 2;
    record.header.unused               = buffer.readUInt16LE(offset);    offset += 2;
    record.header.recordNumber         = buffer.readUint32LE(offset);    offset += 4;
    record.attributes = [];
    console.log(offset);
    console.log(record.header.firstAttributeOffset);
    offset = record.header.firstAttributeOffset;
    while (true) {
        const attributeStartOffset = offset;
        console.log(offset);
        const attribute: Attribute = {} as Attribute;
        const baseHeader: BaseAttributeHeader = {} as BaseAttributeHeader;
        baseHeader.attributeType = buffer.readUInt32LE(offset);                 offset += 4;
        baseHeader.length        = buffer.readUint32LE(offset);                 offset += 4;
        baseHeader.nonResident   = buffer.readUint8(offset) > 0 ? true : false; offset += 1;
        baseHeader.nameLength    = buffer.readUint8(offset);                    offset += 1;
        baseHeader.nameOffset    = buffer.readUint16LE(offset);                 offset += 2;
        baseHeader.flags         = buffer.readUint16LE(offset);                 offset += 2;
        baseHeader.attributeId   = buffer.readUint16LE(offset);                 offset += 2;
        if (baseHeader.nonResident) {
            attribute.header = baseHeader as NonResidentAttributeHeader;
            attribute.header.firstCluster       = buffer.readBigInt64LE(offset);  offset += 8;
            attribute.header.lastCluster        = buffer.readBigInt64LE(offset);  offset += 8;
            attribute.header.dataRunsOffset     = buffer.readUInt16LE(offset);    offset += 2;
            attribute.header.compressionUnit    = buffer.readUInt16LE(offset);    offset += 2;
            attribute.header.unused             = buffer.readUInt32LE(offset);    offset += 4;
            attribute.header.attributeAllocated = buffer.readBigUint64LE(offset); offset += 8;
            attribute.header.attributeSize      = buffer.readBigUint64LE(offset); offset += 8;
            attribute.header.streamDataSize     = buffer.readBigUint64LE(offset); offset += 8;
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
        } else {
            attribute.header = baseHeader as ResidentAttributeHeader;
            attribute.header.valueLength = buffer.readUint32LE(offset);                 offset += 4;
            attribute.header.valueOffset = buffer.readUint16LE(offset);                 offset += 2;
            attribute.header.indexed     = buffer.readUint8(offset) > 0 ? true : false; offset += 1;
            attribute.header.unused      = buffer.readUint8(offset);                    offset += 1;
        }
        
        record.attributes.push(attribute);
        if (attribute.header.attributeType === AttributeType.END) {
            break;
        }
        offset = attributeStartOffset + attribute.header.length;
    }
    return record;
}

function parseFileRecordAttribute(buffer: Buffer) {
    
}
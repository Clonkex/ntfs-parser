import fs, { type FileHandle } from 'fs/promises';

const PARTITION_BOOT_SECTOR_LENGTH = 512;
const BPB_LENGTH = 25;
const EXTENDED_BPB_LENGTH = 48;
const PARTITION_BOOTSTRAP_CODE_LENGTH = 426;
const FILE_RECORD_SIZE = 1024;
const FILE_RECORD_HEADER_SIZE = 48;
// const BASE_ATTRIBUTE_HEADER_MIN_LENGTH = 16;
// const RESIDENT_ATTRIBUTE_HEADER_MIN_LENGTH = BASE_ATTRIBUTE_HEADER_MIN_LENGTH + 8;
const DATA_RUN_MAX_LENGTH = 17;
// const NON_RESIDENT_ATTRIBUTE_HEADER_MIN_LENGTH = BASE_ATTRIBUTE_HEADER_MIN_LENGTH + 48;

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

class BPB {
    public bytesPerSector = 0;    // 2 bytes
    public sectorsPerCluster = 0; // 1 byte
    public reservedSectors = 0;   // 2 bytes
    public alwaysZero1 = 0;       // 3 bytes
    public unused1 = 0;           // 2 bytes
    public mediaDescripter = 0;   // 1 byte
    public alwaysZero2 = 0;       // 2 bytes
    public sectorsPerTrack = 0;   // 2 bytes
    public numberOfHeads = 0;     // 2 bytes
    public hiddenSectors = 0;     // 4 bytes
    public unused2 = 0;           // 4 bytes
    
    public parse(buffer: Buffer): number {
        if (buffer.byteLength < BPB_LENGTH) {
            throw new Error(`Buffer is too short for BPB (${buffer.byteLength} < ${{BPB_LENGTH}})`);
        }
        let offset = 0;
        this.bytesPerSector    = buffer.readUint16LE(offset);  offset += 2;
        this.sectorsPerCluster = buffer.readUint8(offset);     offset += 1;
        this.reservedSectors   = buffer.readUint16LE(offset);  offset += 2;
        this.alwaysZero1       = buffer.readUintLE(offset, 3); offset += 3;
        this.unused1           = buffer.readUint16LE(offset);  offset += 2;
        this.mediaDescripter   = buffer.readUint8(offset);     offset += 1;
        this.alwaysZero2       = buffer.readUint16LE(offset);  offset += 2;
        this.sectorsPerTrack   = buffer.readUint16LE(offset);  offset += 2;
        this.numberOfHeads     = buffer.readUint16LE(offset);  offset += 2;
        this.hiddenSectors     = buffer.readUint32LE(offset);  offset += 4;
        this.unused2           = buffer.readUint32LE(offset);  offset += 4;
        return offset;
    }
}

class ExtendedBPB {
    public unused1 = 0;                        // 4 bytes
    public totalSectors = 0n;                  // 8 bytes
    public mftLogicalClusterNumber = 0n;       // 8 bytes
    public mftMirrorLogicalClusterNumber = 0n; // 8 bytes
    public clustersPerFileRecordSegment = 0;   // 4 bytes
    public clustersPerIndexBuffer = 0;         // 1 byte
    public unused2 = 0;                        // 3 bytes
    public volumeSerialNumber = 0n;            // 8 bytes
    public checksum = 0;                       // 4 bytes
    
    public parse(buffer: Buffer): number {
        if (buffer.byteLength < EXTENDED_BPB_LENGTH) {
            throw new Error(`Buffer is too short for extended BPB (${buffer.byteLength} < ${{EXTENDED_BPB_LENGTH}})`);
        }
        let offset = 0;
        this.unused1                       = buffer.readUInt32LE(offset);    offset += 4;
        this.totalSectors                  = buffer.readBigUInt64LE(offset); offset += 8;
        this.mftLogicalClusterNumber       = buffer.readBigUint64LE(offset); offset += 8;
        this.mftMirrorLogicalClusterNumber = buffer.readBigUint64LE(offset); offset += 8;
        this.clustersPerFileRecordSegment  = buffer.readUInt32LE(offset);    offset += 4;
        this.clustersPerIndexBuffer        = buffer.readUint8(offset);       offset += 1;
        this.unused2                       = buffer.readUintLE(offset, 3);   offset += 3;
        this.volumeSerialNumber            = buffer.readBigUint64LE(offset); offset += 8;
        this.checksum                      = buffer.readUInt32LE(offset);    offset += 4;
        return offset;
    }
}

class PartitionBootSector {
    public jumpInstruction = 0;             // 3 bytes
    public oemId = '';                      // 8 bytes
    public bpb = new BPB();                 // 25 bytes
    public extendedBpb = new ExtendedBPB(); // 48 bytes
    public bootstrapCode = Buffer.alloc(0); // 426 bytes
    public endOfSectorMarker = 0;           // 2 bytes
    
    public parse(buffer: Buffer): number {
        if (buffer.byteLength < PARTITION_BOOT_SECTOR_LENGTH) {
            throw new Error(`Buffer is too short for partition boot sector (${buffer.byteLength} < ${{PARTITION_BOOT_SECTOR_LENGTH}})`);
        }
        let offset = 0;
        this.jumpInstruction   = buffer.readUintLE(offset, 3);                                      offset += 3;
        this.oemId             = buffer.toString('ascii', offset, offset + 8);                      offset += 8;
        offset += this.bpb.parse(buffer.subarray(offset, offset + BPB_LENGTH));
        offset += this.extendedBpb.parse(buffer.subarray(offset, offset + EXTENDED_BPB_LENGTH));
        this.bootstrapCode     = buffer.subarray(offset, offset + PARTITION_BOOTSTRAP_CODE_LENGTH); offset += PARTITION_BOOTSTRAP_CODE_LENGTH;
        this.endOfSectorMarker = buffer.readUInt16LE(offset);                                       offset += 2;
        return offset;
    }
}

class FileRecordHeader {
    public magic = '';               // 4 bytes, always FILE or BAAD
    public updateSequenceOffset = 0; // 2 bytes
    public updateSequenceSize = 0;   // 2 bytes
    public logSequence = 0n;         // 8 bytes
    public sequenceNumber = 0;       // 2 bytes
    public hardLinkCount = 0;        // 2 bytes
    public firstAttributeOffset = 0; // 2 bytes, number of bytes between the start of the header and the first attribute header
    public flags = 0;                // 2 bytes
    public usedSize = 0;             // 4 bytes
    public allocatedSize = 0;        // 4 bytes
    public fileReference = 0n;       // 8 bytes
    public nextAttributeId = 0;      // 2 bytes
    public unused = 0;               // 2 bytes
    public recordNumber = 0;         // 4 bytes
    
    public parse(buffer: Buffer): number {
        if (buffer.byteLength < FILE_RECORD_HEADER_SIZE) {
            throw new Error(`Buffer is too short for file record header (${buffer.byteLength} < ${{FILE_RECORD_HEADER_SIZE}})`);
        }
        let offset = 0;
        this.magic                = buffer.toString('ascii', 0, 4); offset += 4;
        this.updateSequenceOffset = buffer.readUint16LE(offset);    offset += 2;
        this.updateSequenceSize   = buffer.readUint16LE(offset);    offset += 2;
        this.logSequence          = buffer.readBigUint64LE(offset); offset += 8;
        this.sequenceNumber       = buffer.readUint16LE(offset);    offset += 2;
        this.hardLinkCount        = buffer.readUint16LE(offset);    offset += 2;
        this.firstAttributeOffset = buffer.readUint16LE(offset);    offset += 2;
        this.flags                = buffer.readUint16LE(offset);    offset += 2;
        this.usedSize             = buffer.readUInt32LE(offset);    offset += 4;
        this.allocatedSize        = buffer.readUInt32LE(offset);    offset += 4;
        this.fileReference        = buffer.readBigUInt64LE(offset); offset += 8;
        this.nextAttributeId      = buffer.readUInt16LE(offset);    offset += 2;
        this.unused               = buffer.readUInt16LE(offset);    offset += 2;
        this.recordNumber         = buffer.readUint32LE(offset);    offset += 4;
        return offset;
    }
}

class BaseAttributeHeader {
    public attributeType = AttributeType.STANDARD_INFORMATION;
    public length = 0;
    public nonResident = false;
    public nameLength = 0;
    public nameOffset = 0;
    public flags = 0;
    public attributeId = 0;
    public name = '';
    
    public parse(buffer: Buffer): number {
        let offset = 0;
        this.attributeType = buffer.readUInt32LE(offset);                 offset += 4;
        this.length        = buffer.readUint32LE(offset);                 offset += 4;
        this.nonResident   = buffer.readUint8(offset) > 0 ? true : false; offset += 1;
        this.nameLength    = buffer.readUint8(offset);                    offset += 1;
        this.nameOffset    = buffer.readUint16LE(offset);                 offset += 2;
        this.flags         = buffer.readUint16LE(offset);                 offset += 2;
        this.attributeId   = buffer.readUint16LE(offset);                 offset += 2;
        if (this.nameLength > 0) {
            this.name = buffer.toString('utf8', this.nameOffset, this.nameOffset + this.nameLength);
        }
        return offset;
    }
    
    public static parseIsNonResident(buffer: Buffer): boolean {
        return buffer.readUint8(8) > 0 ? true : false;
    }
}

class ResidentAttributeHeader extends BaseAttributeHeader {
    public nonResident = false as const;
    public valueLength = 0;
    public valueOffset = 0;
    public indexed = false;
    public unused = 0;
    
    public parse(buffer: Buffer): number {
        let offset = 0;
        offset += super.parse(buffer);
        this.valueLength = buffer.readUint32LE(offset);                 offset += 4;
        this.valueOffset = buffer.readUint16LE(offset);                 offset += 2;
        this.indexed     = buffer.readUint8(offset) > 0 ? true : false; offset += 1;
        this.unused      = buffer.readUint8(offset);                    offset += 1;
        return offset;
    }
}

class DataRun {
    public lengthFieldLength = 0; // The number of bytes used to make up `length`
    public offsetFieldLength = 0; // The number of bytes used to make up `offset`
    public length = 0n;           // A variable-length field from 1 to 8 bytes
    public offset = 0n;           // A variable-length field from 1 to 8 bytes
    
    public parse(buffer: Buffer): number {
        if (buffer.byteLength < DATA_RUN_MAX_LENGTH) {
            throw new Error(`Buffer is too short for data run (${buffer.byteLength} < ${{DATA_RUN_MAX_LENGTH}})`);
        }
        let offset = 0;
        const fullByte = buffer.readUint8(offset);                                     offset += 1;
        console.log('fullByte: ', fullByte);
        this.lengthFieldLength = fullByte & 0x0F;
        this.offsetFieldLength = (fullByte & 0xF0) >> 4;
        if (fullByte === 0) {
            return offset;
        }
        this.length = BigInt(buffer.readUintLE(offset, this.lengthFieldLength)); offset += this.lengthFieldLength;
        this.offset = BigInt(buffer.readUintLE(offset, this.offsetFieldLength)); offset += this.offsetFieldLength;
        return offset;
    }
}

class NonResidentAttributeHeader extends BaseAttributeHeader {
    public nonResident = true as const;
    public firstCluster = 0n;
    public lastCluster = 0n;
    public dataRunsOffset = 0;
    public compressionUnit = 0;
    public unused = 0;
    public attributeAllocated = 0n;
    public attributeSize = 0n;
    public streamDataSize = 0n;
    public dataRuns: DataRun[] = [];
    
    public parse(buffer: Buffer): number {
        let offset = 0;
        offset += super.parse(buffer);
        this.firstCluster       = buffer.readBigInt64LE(offset);  offset += 8;
        this.lastCluster        = buffer.readBigInt64LE(offset);  offset += 8;
        this.dataRunsOffset     = buffer.readUInt16LE(offset);    offset += 2;
        this.compressionUnit    = buffer.readUInt16LE(offset);    offset += 2;
        this.unused             = buffer.readUInt32LE(offset);    offset += 4;
        this.attributeAllocated = buffer.readBigUint64LE(offset); offset += 8;
        this.attributeSize      = buffer.readBigUint64LE(offset); offset += 8;
        this.streamDataSize     = buffer.readBigUint64LE(offset); offset += 8;
        
        // Parse data runs
        offset = this.dataRunsOffset;
        while (offset < this.length) {
            const dataRun = new DataRun();
            offset += dataRun.parse(buffer.subarray(offset, offset + DATA_RUN_MAX_LENGTH));
            if (dataRun.lengthFieldLength === 0) {
                break;
            }
            this.dataRuns.push(dataRun);
        }
        return offset;
    }
}

type AttributeHeader = ResidentAttributeHeader | NonResidentAttributeHeader;

class Attribute {
    public header: AttributeHeader = new ResidentAttributeHeader();
    public contents = Buffer.alloc(0);
    
    public parse(buffer: Buffer): void {
        const nonResident = BaseAttributeHeader.parseIsNonResident(buffer);
        if (nonResident) {
            this.header = new NonResidentAttributeHeader();
        }
        this.header.parse(buffer);
        if (this.header.nonResident) {
            this.contents = Buffer.alloc(0);
        } else {
            this.contents = buffer.subarray(this.header.valueOffset, this.header.valueOffset + this.header.length);
        }
    }
}

class FileRecord {
    public header = new FileRecordHeader();
    public attributes: Attribute[] = [];
    
    public parse(buffer: Buffer): number {
        if (buffer.byteLength < FILE_RECORD_SIZE) {
            throw new Error(`Buffer is too short for file record (${buffer.byteLength} < ${{FILE_RECORD_SIZE}})`);
        }
        let offset = 0;
        offset += this.header.parse(buffer.subarray(offset, offset + FILE_RECORD_HEADER_SIZE));
        console.log(offset);
        console.log(this.header.firstAttributeOffset);
        let attributeStartOffset = this.header.firstAttributeOffset;
        while (true) {
            console.log(attributeStartOffset);
            const attribute = new Attribute();
            attribute.parse(buffer.subarray(attributeStartOffset));
            this.attributes.push(attribute);
            if (attribute.header.attributeType === AttributeType.END) {
                break;
            }
            attributeStartOffset += attribute.header.length;
        }
        return attributeStartOffset;
    }
}

await main();

async function main(): Promise<void> {
    const file = await fs.open('N:/jesslap/backup-nvme0n1p1.img');
    
    const partitionBootSectorBuffer = Buffer.alloc(PARTITION_BOOT_SECTOR_LENGTH);
    await file.read(partitionBootSectorBuffer, 0, PARTITION_BOOT_SECTOR_LENGTH, 0);
    const bootSector = new PartitionBootSector();
    bootSector.parse(partitionBootSectorBuffer);
    console.log(bootSector);
    
    const mftFileRecordBuffer = Buffer.alloc(FILE_RECORD_SIZE);
    const mftStartByte = bootSector.extendedBpb.mftLogicalClusterNumber * BigInt(bootSector.bpb.sectorsPerCluster) * BigInt(bootSector.bpb.bytesPerSector);
    await file.read(mftFileRecordBuffer, 0, FILE_RECORD_SIZE, Number(mftStartByte));
    const mftFileRecord = new FileRecord();
    mftFileRecord.parse(mftFileRecordBuffer);
    console.dir(mftFileRecord, {depth: null});
    
    const dataAttribute = mftFileRecord.attributes.find(a => a.header.attributeType === AttributeType.DATA);
    if (dataAttribute === undefined) {
        throw new Error('No data attribute for MFT file');
    }
    if (!dataAttribute.header.nonResident) {
        throw new Error('Data attribute for MFT file is resident (this is unexpected)');
    }
    
    //const data = readFileData(file, mftFileRecord);
    console.log('about to read filename');
    const filename = readFileName(file, mftFileRecord);
    console.log(filename);
}

function readFileName(file: FileHandle, fileRecord: FileRecord): string {
    const filenameAttribute = fileRecord.attributes.find(a => a.header.attributeType === AttributeType.FILE_NAME);
    if (filenameAttribute === undefined) {
        throw new Error('File does not contain filename attribute');
    }
    if (filenameAttribute.header.nonResident) {
        for (const dataRun of filenameAttribute.header.dataRuns) {
            console.log(dataRun);
        }
        return '';
    } else {
        console.log(filenameAttribute.contents);
        console.log(filenameAttribute.contents.toString('ascii'));
        return 'lel resident name';
    }
}

//function readFileData(file: FileHandle, fileRecord: FileRecord): Buffer {
//    if (fileRecord.header.)
//}
export {};
// import fs from 'fs/promises';
// 
// class BPB {
//     public bytesPerSector: number;    // 2 bytes
//     public sectorsPerCluster: number; // 1 byte
//     public reservedSectors: number;   // 2 bytes
//     public alwaysZero1: number;       // 3 bytes
//     public unused1: number;           // 2 bytes
//     public mediaDescripter: number;   // 1 byte
//     public alwaysZero2: number;       // 2 bytes
//     public sectorsPerTrack: number;   // 2 bytes
//     public numberOfHeads: number;     // 2 bytes
//     public hiddenSectors: number;     // 4 bytes
//     public unused2: number;           // 4 bytes
//     public _length: number;
//     
//     public constructor(buffer: Buffer) {
//         let offset = 0;
//         this.bytesPerSector    = buffer.readUint16LE(offset);  offset += 2;
//         this.sectorsPerCluster = buffer.readUint8(offset);     offset += 1;
//         this.reservedSectors   = buffer.readUint16LE(offset);  offset += 2;
//         this.alwaysZero1       = buffer.readUintLE(offset, 3); offset += 3;
//         this.unused1           = buffer.readUint16LE(offset);  offset += 2;
//         this.mediaDescripter   = buffer.readUint8(offset);     offset += 1;
//         this.alwaysZero2       = buffer.readUint16LE(offset);  offset += 2;
//         this.sectorsPerTrack   = buffer.readUint16LE(offset);  offset += 2;
//         this.numberOfHeads     = buffer.readUint16LE(offset);  offset += 2;
//         this.hiddenSectors     = buffer.readUint32LE(offset);  offset += 4;
//         this.unused2           = buffer.readUint32LE(offset);  offset += 4;
//         this._length = offset;
//     }
// }
// 
// class ExtendedBPB {
//     public unused1: number;                       // 4 bytes
//     public totalSectors: bigint;                  // 8 bytes
//     public mftLogicalClusterNumber: bigint;       // 8 bytes
//     public mftMirrorLogicalClusterNumber: bigint; // 8 bytes
//     public clustersPerFileRecordSegment: number;  // 4 bytes
//     public clustersPerIndexBuffer: number;        // 1 byte
//     public unused2: number;                       // 3 bytes
//     public volumeSerialNumber: bigint;            // 8 bytes
//     public checksum: number;                      // 4 bytes
//     public _length: number;
//     
//     public constructor(buffer: Buffer) {
//         let offset = 0;
//         this.unused1 =                       buffer.readUInt32LE(offset);    offset += 4;
//         this.totalSectors =                  buffer.readBigUInt64LE(offset); offset += 8;
//         this.mftLogicalClusterNumber =       buffer.readBigUint64LE(offset); offset += 8;
//         this.mftMirrorLogicalClusterNumber = buffer.readBigUint64LE(offset); offset += 8;
//         this.clustersPerFileRecordSegment =  buffer.readUInt32LE(offset);    offset += 4;
//         this.clustersPerIndexBuffer =        buffer.readUint8(offset);       offset += 1;
//         this.unused2 =                       buffer.readUintLE(offset, 3);   offset += 3;
//         this.volumeSerialNumber =            buffer.readBigUint64LE(offset); offset += 8;
//         this.checksum =                      buffer.readUInt32LE(offset);    offset += 4;
//         this._length = offset;
//     }
// }
// 
// class PartitionBootSector {
//     public jumpInstruction: number;   // 3 bytes
//     public oemId: string;             // 8 bytes
//     public bpb: BPB;                  // 25 bytes
//     public extendedBpb: ExtendedBPB;  // 48 bytes
//     public bootstrapCode: Buffer;     // 426 bytes
//     public endOfSectorMarker: number; // 2 bytes
//     public _length: number;
//     
//     public constructor(buffer: Buffer) {
//         let offset = 0;
//         this.jumpInstruction   = buffer.readUintLE(offset, 3);                          offset += 3;
//         this.oemId             = buffer.toString('ascii', offset, offset + 8);          offset += 8;
//         this.bpb               = new BPB(buffer.subarray(offset, offset + 25));         offset += 25;
//         this.extendedBpb       = new ExtendedBPB(buffer.subarray(offset, offset + 48)); offset += 48;
//         this.bootstrapCode     = buffer.subarray(offset, offset + 426);                 offset += 426;
//         this.endOfSectorMarker = buffer.readUInt16LE(offset);                           offset += 2;
//         this._length = offset;
//     }
// }
// 
// class FileRecordHeader {
//     public magic: string;                // 4 bytes, always FILE or BAAD
//     public updateSequenceOffset: number; // 2 bytes
//     public updateSequenceSize: number;   // 2 bytes
//     public logSequence: bigint;          // 8 bytes
//     public sequenceNumber: number;       // 2 bytes
//     public hardLinkCount: number;        // 2 bytes
//     public firstAttributeOffset: number; // 2 bytes, number of bytes between the start of the header and the first attribute header
//     public flags: number;                // 2 bytes
//     public usedSize: number;             // 4 bytes
//     public allocatedSize: number;        // 4 bytes
//     public fileReference: bigint;        // 8 bytes
//     public nextAttributeId: number;      // 2 bytes
//     public unused: number;               // 2 bytes
//     public recordNumber: number;         // 4 bytes
//     public _length: number;
//     
//     public constructor(buffer: Buffer) {
//         let offset = 0;
//         this.magic                = buffer.toString('ascii', 0, 4); offset += 4;
//         this.updateSequenceOffset = buffer.readUint16LE(offset);    offset += 2;
//         this.updateSequenceSize   = buffer.readUint16LE(offset);    offset += 2;
//         this.logSequence          = buffer.readBigUint64LE(offset); offset += 8;
//         this.sequenceNumber       = buffer.readUint16LE(offset);    offset += 2;
//         this.hardLinkCount        = buffer.readUint16LE(offset);    offset += 2;
//         this.firstAttributeOffset = buffer.readUint16LE(offset);    offset += 2;
//         this.flags                = buffer.readUint16LE(offset);    offset += 2;
//         this.usedSize             = buffer.readUInt32LE(offset);    offset += 4;
//         this.allocatedSize        = buffer.readUInt32LE(offset);    offset += 4;
//         this.fileReference        = buffer.readBigUInt64LE(offset); offset += 8;
//         this.nextAttributeId      = buffer.readUInt16LE(offset);    offset += 2;
//         this.unused               = buffer.readUInt16LE(offset);    offset += 2;
//         this.recordNumber         = buffer.readUint32LE(offset);    offset += 4;
//         this._length = offset;
//     }
// }
// 
// enum AttributeType {
//     STANDARD_INFORMATION  = 0x10,
//     ATTRIBUTE_LIST        = 0x20,
//     FILE_NAME             = 0x30,
//     OBJECT_ID             = 0x40, // VOLUME_VERSION in NTFS 1.2
//     SECURITY_DESCRIPTOR   = 0x50,
//     VOLUME_NAME           = 0x60,
//     VOLUME_INFORMATION    = 0x70,
//     DATA                  = 0x80,
//     INDEX_ROOT            = 0x90,
//     INDEX_ALLOCATION      = 0xA0,
//     BITMAP                = 0xB0,
//     REPARSE_POINT         = 0xC0, // SYMBOLIC_LINK in NTFS 1.2
//     EA_INFORMATION        = 0xD0,
//     EA                    = 0xE0,
//     LOGGED_UTILITY_STREAM = 0x100,
//     END                   = 0xFFFFFFFF,
// }
// 
// const BaseAttributeHeader_MinLength = 16;
// class BaseAttributeHeader {
//     public attributeType: AttributeType;
//     public length: number;
//     public nonResident: boolean;
//     public nameLength: number;
//     public nameOffset: number;
//     public flags: number;
//     public attributeId: number;
//     public _length: number;
//     
//     public constructor(buffer: Buffer) {
//         let offset = 0;
//         this.attributeType = buffer.readUInt32LE(offset);                 offset += 4;
//         this.length        = buffer.readUint32LE(offset);                 offset += 4;
//         this.nonResident   = buffer.readUint8(offset) > 0 ? true : false; offset += 1;
//         this.nameLength    = buffer.readUint8(offset);                    offset += 1;
//         this.nameOffset    = buffer.readUint16LE(offset);                 offset += 2;
//         this.flags         = buffer.readUint16LE(offset);                 offset += 2;
//         this.attributeId   = buffer.readUint16LE(offset);                 offset += 2;
//         this._length = offset;
//     }
// }
// 
// const ResidentAttributeHeader_MinLength = BaseAttributeHeader_MinLength + 8;
// class ResidentAttributeHeader extends BaseAttributeHeader {
//     public nonResident = false as const;
//     public valueLength: number;
//     public valueOffset: number;
//     public indexed: boolean;
//     public unused: number;
//     
//     public constructor(buffer: Buffer) {
//         super(buffer);
//         let offset = this._length;
//         this.valueLength = buffer.readUint32LE(offset);                 offset += 4;
//         this.valueOffset = buffer.readUint16LE(offset);                 offset += 2;
//         this.indexed     = buffer.readUint8(offset) > 0 ? true : false; offset += 1;
//         this.unused      = buffer.readUint8(offset);                    offset += 1;
//         this._length = offset;
//     }
// }
// 
// class DataRun {
//     public lengthFieldLength: number; // The number of bytes used to make up `length`
//     public offsetFieldLength: number; // The number of bytes used to make up `offset`
//     public length: bigint;            // A variable-length field from 1 to 8 bytes
//     public offset: bigint;            // A variable-length field from 1 to 8 bytes
//     public _length: number;
//     
//     public constructor(buffer: Buffer) {
//         let offset = 0;
//         const fullByte = buffer.readUint8(offset);                               offset += 1;
//         this.lengthFieldLength = fullByte & 0x0F;
//         this.offsetFieldLength = (fullByte & 0xF0) >> 4;
//         this.length = BigInt(buffer.readUintLE(offset, this.lengthFieldLength)); offset += this.lengthFieldLength;
//         this.offset = BigInt(buffer.readUintLE(offset, this.offsetFieldLength)); offset += this.offsetFieldLength;
//         this._length = offset;
//     }
// }
// 
// const NonResidentAttributeHeader_MinLength = BaseAttributeHeader_MinLength + 48;
// class NonResidentAttributeHeader extends BaseAttributeHeader {
//     public nonResident = true as const;
//     public firstCluster: bigint;
//     public lastCluster: bigint;
//     public dataRunsOffset: number;
//     public compressionUnit: number;
//     public unused: number;
//     public attributeAllocated: bigint;
//     public attributeSize: bigint;
//     public streamDataSize: bigint;
//     public dataRuns: DataRun[];
//     
//     public constructor(buffer: Buffer) {
//         super(buffer);
//         let offset = this._length;
//         this.firstCluster       = buffer.readBigInt64LE(offset);  offset += 8;
//         this.lastCluster        = buffer.readBigInt64LE(offset);  offset += 8;
//         this.dataRunsOffset     = buffer.readUInt16LE(offset);    offset += 2;
//         this.compressionUnit    = buffer.readUInt16LE(offset);    offset += 2;
//         this.unused             = buffer.readUInt32LE(offset);    offset += 4;
//         this.attributeAllocated = buffer.readBigUint64LE(offset); offset += 8;
//         this.attributeSize      = buffer.readBigUint64LE(offset); offset += 8;
//         this.streamDataSize     = buffer.readBigUint64LE(offset); offset += 8;
//         this._length = offset;
//         this.dataRuns = [];
//         offset = this.dataRunsOffset;
//         while (offset < this.length) {
//             const subBuffer = buffer.subarray(offset, offset + 17);
//             if (subBuffer.readUint8(0) === 0) { // jank way of checking for an empty data run which apparently can indicate no more data runs (is this always the case?)
//                 break;
//             }
//             const dataRun = new DataRun(subBuffer); // theoretically data runs can only be 1 + 8 + 8 bytes long
//             this.dataRuns.push(dataRun);
//             offset += 1 + dataRun.lengthFieldLength + dataRun.offsetFieldLength;
//         }
//     }
// }
// 
// type AttributeHeader = ResidentAttributeHeader | NonResidentAttributeHeader;
// 
// class Attribute {
//     public header: AttributeHeader;
//     public contents: Buffer;
//     
//     public constructor(buffer: Buffer) {
//         const baseHeader = new BaseAttributeHeader(buffer.subarray(0, 16));
//         if (baseHeader.nonResident) {
//             this.header = new NonResidentAttributeHeader(buffer.subarray(0, Math.max(NonResidentAttributeHeader_MinLength, baseHeader.length)));
//         } else {
//             this.header = new ResidentAttributeHeader(buffer.subarray(0, Math.max(ResidentAttributeHeader_MinLength, baseHeader.length)));
//         }
//         this.contents = Buffer.alloc(1);
//     }
// }
// 
// class FileRecord {
//     public header: FileRecordHeader;
//     public attributes: Attribute[];
//     
//     public constructor(buffer: Buffer) {
//         this.header = new FileRecordHeader(buffer);
//         this.attributes = [];
//         let offset = this.header.firstAttributeOffset;
//         while (true) {
//             const attribute = new Attribute(buffer.subarray(offset));
//             this.attributes.push(attribute);
//             if (attribute.header.attributeType === AttributeType.END) {
//                 break;
//             }
//             offset += attribute.header.length;
//         }
//     }
// }
// 
// await main();
// 
// async function main(): Promise<void> {
//     const file = await fs.open('N:/jesslap/backup-nvme0n1p3.img');
//     
//     const partitionBootSectorBuffer = Buffer.alloc(512);
//     await file.read(partitionBootSectorBuffer, 0, 512, 0);
//     const bootSector = new PartitionBootSector(partitionBootSectorBuffer);
//     console.log(bootSector);
//     
//     const mftFileRecordBuffer = Buffer.alloc(1024);
//     const mftStartByte = bootSector.extendedBpb.mftLogicalClusterNumber * BigInt(bootSector.bpb.sectorsPerCluster) * BigInt(bootSector.bpb.bytesPerSector);
//     await file.read(mftFileRecordBuffer, 0, 1024, Number(mftStartByte));
//     const mftFileRecord = new FileRecord(mftFileRecordBuffer);
//     console.dir(mftFileRecord, {depth: null});
//     
//     const dataAttribute = mftFileRecord.attributes.find(a => a.header.attributeType === AttributeType.DATA);
//     if (dataAttribute === undefined) {
//         throw new Error('No data attribute for MFT file');
//     }
//     if (!dataAttribute.header.nonResident) {
//         throw new Error('Data attribute for MFT file is resident (this is unexpected)');
//     }
//     
//     //dataAttribute.header.dataRunsOffset
// }
//# sourceMappingURL=main-old.js.map
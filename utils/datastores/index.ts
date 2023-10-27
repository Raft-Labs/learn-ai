import { blake3, createBLAKE3 } from "hash-wasm";
import { Document } from "./base";
import { Chunk } from "@/types";
import uuidv4 from "../uuid";
import { QdrantManager } from "./qdrant-new";
import {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
} from "langchain/text_splitter";

const chunkSize: number = 256;
export class DatastoreManager {
  chunkSize: number = 256;
  manager: QdrantManager;
  constructor() {
    this.manager = new QdrantManager();
  }
  async upload(document: Document) {
    const chunks = await this.handleSplitDocument(document);

    return this.manager.upload(chunks);
  }

  search(props: any) {
    return this.manager.search(props);
  }

  // Delete datastore
  delete() {
    return this.manager.delete();
  }

  // Delete datasource
  remove(datasourceId: string) {
    return this.manager.remove(datasourceId);
  }

  static async hash(document: Document) {
    const tags = document.metadata?.tags || ([] as string[]);
    const hasher = await createBLAKE3();
    hasher.init();
    hasher.update(document.metadata?.datasource_id as string);
    hasher.update(document.pageContent);

    for (const tag of tags || []) {
      hasher.update(tag);
    }

    return hasher.digest("hex");
  }

  async handleSplitDocument(document: Document) {
    const textSplitter = new TokenTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: 24,
    });
    // const splitters = await this.importSplitters();

    const splitDocs = await textSplitter.splitDocuments([document]);

    const datasource_hash = await DatastoreManager.hash(document);

    const chunks: Chunk[] = [];

    for (const [index, each] of splitDocs.entries()) {
      const chunk_hash = await blake3(each.pageContent);

      chunks.push({
        ...each,
        metadata: {
          ...each?.metadata,
          datastore_id: process.env.DATASTORE_ID as string,
          chunk_id: uuidv4(),
          chunk_hash,
          datasource_hash,
          chunk_offset: index,
        },
      });
    }

    return chunks;
  }
}

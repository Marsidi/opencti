/* eslint-disable camelcase,no-case-declarations */
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import * as R from 'ramda';
import jsonCanonicalize from 'canonicalize';
import { DatabaseError } from '../config/errors';
// eslint-disable-next-line import/no-cycle
import { internalLoadEntityById } from '../database/grakn';
import { convertEntityTypeToStixType } from './schemaUtils';
import * as I from './internalObject';
import * as D from './stixDomainObject';
import * as M from './stixMetaObject';
import * as C from './stixCyberObservableObject';
import { OASIS_NAMESPACE, OPENCTI_NAMESPACE, OPENCTI_PLATFORM_UUID } from './general';
import { isStixMetaObject } from './stixMetaObject';
import { isStixDomainObject } from './stixDomainObject';
import { isStixCyberObservable } from './stixCyberObservableObject';
import { isInternalObject } from './internalObject';
import { isInternalRelationship } from './internalRelationship';
import { isStixCoreRelationship } from './stixCoreRelationship';
import { isStixMetaRelationship } from './stixMetaRelationship';
import { isStixSightingRelationship } from './stixSightingRelationship';

const idGen = (data, namespace) => {
  // If element have nothing participating to the key, we can only create an uuidv4
  if (R.isEmpty(data)) return uuidv4();
  const dataCanonicalize = jsonCanonicalize(data);
  return uuidv5(dataCanonicalize, namespace);
};
const entityContribution = {
  definition: {
    // Internal
    [I.ENTITY_TYPE_CAPABILITY]: [{ src: 'name' }],
    [I.ENTITY_TYPE_CONNECTOR]: [{ src: 'name' }],
    [I.ENTITY_TYPE_ROLE]: [{ src: 'name' }],
    [I.ENTITY_TYPE_GROUP]: [{ src: 'name' }],
    [I.ENTITY_TYPE_USER]: [{ src: 'user_email' }],
    [I.ENTITY_TYPE_TOKEN]: [{ src: 'uuid' }],
    [I.ENTITY_TYPE_WORKSPACE]: [{ src: 'name' }, { src: 'workspace_type' }],
    [I.ENTITY_TYPE_SETTINGS]: [{ src: 'opencti_platform' }],
    // Stix Domain
    [D.ENTITY_TYPE_CONTAINER_REPORT]: [{ src: 'name' }, { src: 'published' }],
    [D.ENTITY_TYPE_INDICATOR]: [{ src: 'pattern' }],
    [D.ENTITY_TYPE_ATTACK_PATTERN]: [{ src: 'name' }, { src: 'x_mitre_id' }],
    // Stix Meta
    [M.ENTITY_TYPE_MARKING_DEFINITION]: [{ src: 'definition' }, { src: 'definition_type' }],
    [M.ENTITY_TYPE_LABEL]: [{ src: 'value' }],
    [M.ENTITY_TYPE_KILL_CHAIN_PHASE]: [{ src: 'phase_name' }, { src: 'kill_chain_name' }],
    [M.ENTITY_TYPE_EXTERNAL_REFERENCE]: [[{ src: 'url' }], [{ src: 'source_name' }, { src: 'external_id' }]],
    // Observables
    [C.ENTITY_AUTONOMOUS_SYSTEM]: [{ src: 'number' }],
    [C.ENTITY_EMAIL_MESSAGE]: [{ src: 'from', dest: 'from_ref' }, { src: 'subject' }, { src: 'body' }],
    [C.ENTITY_HASHED_OBSERVABLE_ARTIFACT]: [{ src: 'hashes' }, { src: 'payload_bin' }],
    [C.ENTITY_HASHED_OBSERVABLE_STIX_FILE]: [{ src: 'hashes' }, { src: 'name' }, { src: 'extensions' }],
    [C.ENTITY_HASHED_OBSERVABLE_X509_CERTIFICATE]: [{ src: 'hashes' }, { src: 'serial_number' }],
    [C.ENTITY_DIRECTORY]: [{ src: 'name' }],
    [C.ENTITY_DOMAIN_NAME]: [{ src: 'name' }],
    [C.ENTITY_EMAIL_ADDR]: [{ src: 'name' }],
    [C.ENTITY_IPV4_ADDR]: [{ src: 'name' }],
    [C.ENTITY_IPV6_ADDR]: [{ src: 'name' }],
    [C.ENTITY_MAC_ADDR]: [{ src: 'name' }],
    [C.ENTITY_MUTEX]: [{ src: 'name' }],
    [C.ENTITY_URL]: [{ src: 'name' }],
    [C.ENTITY_X_OPENCTI_CRYPTOGRAPHIC_KEY]: [{ src: 'name' }],
    [C.ENTITY_X_OPENCTI_CRYPTOGRAPHIC_WALLET]: [{ src: 'name' }],
    [C.ENTITY_X_OPENCTI_HOSTNAME]: [{ src: 'name' }],
    [C.ENTITY_X_OPENCTI_TEXT]: [{ src: 'name' }],
    [C.ENTITY_X_OPENCTI_USER_AGENT]: [{ src: 'name' }],
    [C.ENTITY_NETWORK_TRAFFIC]: [
      { src: 'start' },
      { src: 'src', dest: 'src_ref' },
      { src: 'dst', dest: 'dst_ref' },
      { src: 'src_port' },
      { src: 'dst_port' },
      { src: 'protocols' },
    ],
    [C.ENTITY_PROCESS]: [],
    [C.ENTITY_SOFTWARE]: [{ src: 'name' }, { src: 'cpe' }, { src: 'vendor' }, { src: 'version' }],
    [C.ENTITY_USER_ACCOUNT]: [{ src: 'account_type' }, { src: 'user_id' }, { src: 'account_login' }],
    [C.ENTITY_WINDOWS_REGISTRY_KEY]: [{ src: 'key' }, { src: 'values' }],
  },
  resolvers: {
    async from(id) {
      const fromEntity = await internalLoadEntityById(id);
      return fromEntity && fromEntity.standard_id;
    },
    async src(id) {
      const srcEntity = await internalLoadEntityById(id);
      return srcEntity && srcEntity.standard_id;
    },
    async dst(id) {
      const dstEntity = await internalLoadEntityById(id);
      return dstEntity && dstEntity.standard_id;
    },
    name(data) {
      return data.toLowerCase();
    },
    opencti_platform() {
      return OPENCTI_PLATFORM_UUID;
    },
    published(data) {
      return data?.toISOString();
    },
    hashes(data) {
      const hashDict = JSON.parse(data);
      if (hashDict.MD5) return { MD5: hashDict.MD5 };
      if (hashDict['SHA-1']) return { 'SHA-1': hashDict['SHA-1'] };
      if (hashDict['SHA-256']) return { 'SHA-256': hashDict['SHA-256'] };
      if (hashDict['SHA-512']) return { 'SHA-512': hashDict['SHA-512'] };
      return undefined;
    },
  },
};
const filteredIdContributions = (way, data) => {
  const propertiesToKeep = R.flatten(R.map((t) => t.src, way));
  const dataRelated = R.pick(propertiesToKeep, data);
  if (R.isEmpty(dataRelated)) throw DatabaseError(`Missing attribute to generate the ID`);
  const objectData = {};
  const entries = Object.entries(dataRelated);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const [key, value] = entry;
    const prop = R.find((e) => R.includes(key, e.src), way);
    const { src, dest } = prop;
    const destKey = dest || src;
    const resolver = entityContribution.resolvers[src];
    if (resolver) {
      objectData[destKey] = resolver(value);
    } else {
      objectData[destKey] = value;
    }
  }
  return R.filter((keyValue) => !R.isEmpty(keyValue) && !R.isNil(keyValue), objectData);
};

const generateDataUUID = (type, data) => {
  const properties = entityContribution.definition[type];
  if (!properties) throw DatabaseError(`Unknown definition for type ${type}`);
  if (properties.length === 0) return uuidv4();
  // Handle specific case of static uuid
  if (!Array.isArray(properties)) return properties;
  // In same case ID have multiple possibility for his generation.
  let uuidData;
  const haveDiffWays = Array.isArray(R.head(properties));
  if (haveDiffWays) {
    for (let index = 0; index < properties.length; index += 1) {
      const way = properties[index];
      uuidData = filteredIdContributions(way, data);
      if (!R.isEmpty(uuidData)) break; // Stop as soon as a correct id is find
    }
  } else {
    uuidData = filteredIdContributions(properties, data);
  }
  return uuidData;
};
const generateStixUUID = (type, data) => {
  const dataUUID = generateDataUUID(type, data);
  return idGen(dataUUID, OASIS_NAMESPACE);
};
const generateObjectUUID = (type, data) => {
  const dataUUID = generateDataUUID(type, data);
  return idGen(dataUUID, OPENCTI_NAMESPACE);
};

const generateObjectId = (type, data) => `${convertEntityTypeToStixType(type)}--${generateObjectUUID(type, data)}`;
const generateStixId = (type, data) => `${convertEntityTypeToStixType(type)}--${generateStixUUID(type, data)}`;

export const generateInternalId = () => uuidv4();

export const generateStandardId = (type, data) => {
  // Entities
  if (isStixMetaObject(type)) return generateStixId(type, data);
  if (isStixDomainObject(type)) return generateStixId(type, data);
  if (isStixCyberObservable(type)) return generateStixId(type, data);
  if (isInternalObject(type)) return generateObjectId(type, data);
  // Relations
  if (isInternalRelationship(type)) return `internal-relationship--${generateInternalId()}`;
  if (isStixCoreRelationship(type)) return `relationship--${generateInternalId()}`;
  if (isStixMetaRelationship(type)) return `relationship-meta--${generateInternalId()}`;
  if (isStixSightingRelationship(type)) return `sighting--${generateInternalId()}`;
  // Unknown
  throw DatabaseError(`Cant generate an id for ${type}`);
};
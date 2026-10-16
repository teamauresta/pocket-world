/** Owner01:36 approved source catalog. Entries describe inputs, NOT motion/rig qualification. */
import {loadImportedAsset} from './imported-assets.js';
import {createImportedMaterialLoader} from './imported-materials.js';
export const APPROVED_WILDLIFE=Object.freeze({
  "tiger": {
    "key": "tiger",
    "domain": "land",
    "originalFile": "tiger.glb",
    "originalSha256": "88a420b7d405e13ffb50ed2d7c1d0eceebb4e25002ce32c83af23dd561fb2240",
    "originalTriangles": 33142,
    "originalClips": [
      {
        "name": "Idle",
        "duration": 39.04166793823242
      }
    ],
    "runtimePath": "owner-models/derived/tiger-near.glb",
    "farPath": "owner-models/derived/tiger-far.glb",
    "requiresDerivedGeometry": true,
    "embeddedMetadata": {
      "author": "CGJAY1111 (https://sketchfab.com/CGJAY1111)",
      "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
      "source": "https://sketchfab.com/3d-models/white-tiger-rigged-animated-9dd099d283e54f99b7cbd40b531b1a29",
      "title": "White Tiger (RIGGED ANIMATED)"
    },
    "privateOnly": true
  },
  "rhino": {
    "key": "rhino",
    "domain": "land",
    "originalFile": "rhino.glb",
    "originalSha256": "cee4989e2c417c5e7003518c227922333b526c56ae38d0651fe73faa02b70667",
    "originalTriangles": 4846,
    "originalClips": [
      {
        "name": "CINEMA_4D_Principal",
        "duration": 1.5
      }
    ],
    "runtimePath": "owner-models/native/rhino.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "GremorySaiyan (https://sketchfab.com/GremorySaiyan)",
      "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
      "source": "https://sketchfab.com/3d-models/rhino-animation-walk-a915d9179fe6422b9d669a3a0d726b8e",
      "title": "Rhino Animation Walk"
    },
    "privateOnly": true
  },
  "bear": {
    "key": "bear",
    "domain": "land",
    "originalFile": "bear.glb",
    "originalSha256": "fbf5c9cee54516a18d8fd5986c6ff2b441ec0afe5f688168098d18df7360a224",
    "originalTriangles": 13640,
    "originalClips": [
      {
        "name": "Bear|BlackBear_Idle",
        "duration": 22.5
      },
      {
        "name": "Bear|WalkFast_F",
        "duration": 1.25
      }
    ],
    "runtimePath": "owner-models/native/bear.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "WildMesh 3D (https://sketchfab.com/WildMesh_3D)",
      "license": "CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)",
      "source": "https://sketchfab.com/3d-models/bear-realistic-3d-model-demo-free-8ba2b39b31474ddd96d95d47119250b1",
      "title": "BEAR - Realistic 3D Model (DEMO FREE)"
    },
    "privateOnly": true
  },
  "wolf": {
    "key": "wolf",
    "domain": "land",
    "originalFile": "wolf.glb",
    "originalSha256": "4bbe8043b30c9f1abb55eaf09313ef430c8f22a9c7d1b9e375d496e511222178",
    "originalTriangles": 16262,
    "originalClips": [
      {
        "name": "Wolf|Wolf_Howl",
        "duration": 6.041666507720947
      },
      {
        "name": "Wolf|Wolf_WalkFast_F",
        "duration": 0.9583333134651184
      }
    ],
    "runtimePath": "owner-models/native/wolf.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "WildMesh 3D (https://sketchfab.com/WildMesh_3D)",
      "license": "CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)",
      "source": "https://sketchfab.com/3d-models/wolf-realistic-3d-model-demo-free-8840b859a566485c874a27b1731e1db8",
      "title": "WOLF - Realistic 3D Model (DEMO FREE)"
    },
    "privateOnly": true
  },
  "alligator": {
    "key": "alligator",
    "domain": "land",
    "originalFile": "alligator_-_realistic_3d_model_demo_free.glb",
    "originalSha256": "306e91d338060cc75da3cb33ae628b435f8c014d73fa380e7c70cfc8e69516b0",
    "originalTriangles": 31049,
    "originalClips": [
      {
        "name": "AmericanAligator|AmericanAlligator_Idle",
        "duration": 6.0333333015441895
      },
      {
        "name": "AmericanAligator|AmericanAlligator_Trot_F",
        "duration": 0.800000011920929
      }
    ],
    "runtimePath": "owner-models/derived/alligator-near.glb",
    "farPath": "owner-models/derived/alligator-far.glb",
    "requiresDerivedGeometry": true,
    "embeddedMetadata": {
      "author": "WildMesh 3D (https://sketchfab.com/WildMesh_3D)",
      "license": "CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)",
      "source": "https://sketchfab.com/3d-models/alligator-realistic-3d-model-demo-free-80af5463728149baba78b12f70f6ff5c",
      "title": "ALLIGATOR - Realistic 3D Model (DEMO FREE)"
    },
    "privateOnly": true
  },
  "shark": {
    "key": "shark",
    "domain": "sea",
    "originalFile": "realistic_shark.glb",
    "originalSha256": "875866919d36e888c14674a6e9143b6164dd99c7556335999c8e8ba6f5252ae4",
    "originalTriangles": 423800,
    "originalClips": [
      {
        "name": "Shark Rig|swimming_skeletal.3",
        "duration": 24
      },
      {
        "name": "Shark Rig|circling_skeletal.3",
        "duration": 31.95833396911621
      }
    ],
    "runtimePath": "owner-models/derived/shark-near.glb",
    "farPath": "owner-models/derived/shark-far.glb",
    "requiresDerivedGeometry": true,
    "embeddedMetadata": {
      "author": "MotionStreamStudios (https://sketchfab.com/MotionStreamStudios)",
      "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
      "source": "https://sketchfab.com/3d-models/realistic-shark-e913e5092d2341749ff66e4359b1e4a3",
      "title": "Realistic Shark"
    },
    "privateOnly": true
  },
  "whale": {
    "key": "whale",
    "domain": "sea",
    "originalFile": "rigged_whale.glb",
    "originalSha256": "df65c1e168c500f6696aa4edcc6b8a3153e359b57c2a08d7af447da369bdcdcf",
    "originalTriangles": 10068,
    "originalClips": [
      {
        "name": "whale_1_armature|whale_1_armatureAction",
        "duration": 4.958333492279053
      }
    ],
    "runtimePath": "owner-models/native/whale.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "assetfactory (https://sketchfab.com/assetfactory)",
      "license": "SKETCHFAB Standard (https://sketchfab.com/licenses)",
      "source": "https://sketchfab.com/3d-models/rigged-whale-96ea18a2857443d485a12082418071ea",
      "title": "Rigged whale"
    },
    "privateOnly": true
  },
  "school": {
    "key": "school",
    "domain": "sea",
    "originalFile": "school_of_fish.glb",
    "originalSha256": "8e03e5605671c9bcc908ce76e3e57527d44a2db0e882200a8ae7e19c031e52e1",
    "originalTriangles": 8932,
    "originalClips": [
      {
        "name": "swimming",
        "duration": 40.96666717529297
      }
    ],
    "runtimePath": "owner-models/native/school.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "Titanas YT (https://sketchfab.com/pcarnage252)",
      "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
      "source": "https://sketchfab.com/3d-models/school-of-fish-25494f5c4ead471ab8205aadfbfec0bc",
      "title": "School Of Fish"
    },
    "privateOnly": true
  },
  "turtle": {
    "key": "turtle",
    "domain": "sea",
    "originalFile": "sea_turtle_low_poly.glb",
    "originalSha256": "d1624935729f294fa4a191141276ab9f48b47a826f438d2615e9416708adebe4",
    "originalTriangles": 16218,
    "originalClips": [],
    "runtimePath": "owner-models/native/turtle.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "C.J..Goldman (https://sketchfab.com/C.J..Goldman)",
      "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
      "source": "https://sketchfab.com/3d-models/sea-turtle-low-poly-c92be549c8194136914883309a13a6b5",
      "title": "Sea turtle low poly"
    },
    "privateOnly": true
  },
  "dolphin": {
    "key": "dolphin",
    "domain": "sea",
    "originalFile": "model_101a_-_adult_common_dolphin.glb",
    "originalSha256": "bb51721a15438379a8bd00c6b6347af575e563fd8f06e40f200e7da52737d1a6",
    "originalTriangles": 231248,
    "originalClips": [
      {
        "name": "Swim Cycle",
        "duration": 1.25
      }
    ],
    "runtimePath": "owner-models/derived/dolphin-near.glb",
    "farPath": "owner-models/derived/dolphin-far.glb",
    "requiresDerivedGeometry": true,
    "embeddedMetadata": {
      "author": "DigitalLife3D (https://sketchfab.com/DigitalLife3D)",
      "license": "CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)",
      "source": "https://sketchfab.com/3d-models/model-101a-adult-common-dolphin-806e869737644122a57da96340fa167e",
      "title": "Model 101A - Adult Common Dolphin"
    },
    "privateOnly": true
  },
  "fish": {
    "key": "fish",
    "domain": "sea",
    "originalFile": "fish.glb",
    "originalSha256": "ac752e6ba6646be6c14792365fb29d44c10b694c5e9f8dc4d57de31630cd2a91",
    "originalTriangles": 3926,
    "originalClips": [],
    "runtimePath": "owner-models/native/fish.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "assetfactory (https://sketchfab.com/assetfactory)",
      "license": "SKETCHFAB Standard (https://sketchfab.com/licenses)",
      "source": "https://sketchfab.com/3d-models/fish-74e57a9de7a24975b02d236ea3be614f",
      "title": "Fish"
    },
    "privateOnly": true
  },
  "elephant": {
    "key": "elephant",
    "domain": "land",
    "originalFile": "elephant.glb",
    "originalSha256": "a37ecab1841398b63e765ce7a670c1526bce1d93de6349e01b05603a33b927b7",
    "originalTriangles": 1958,
    "originalClips": [
      {
        "name": "TRS|attack",
        "duration": 2.0416667461395264
      },
      {
        "name": "TRS|bind pose",
        "duration": 0
      },
      {
        "name": "TRS|death",
        "duration": 3.1666667461395264
      },
      {
        "name": "TRS|drop",
        "duration": 2.4583332538604736
      },
      {
        "name": "TRS|drop2",
        "duration": 2.4583332538604736
      },
      {
        "name": "TRS|eating",
        "duration": 4.208333492279053
      },
      {
        "name": "TRS|end idle",
        "duration": 1.2083333730697632
      },
      {
        "name": "TRS|fight",
        "duration": 2.3333332538604736
      },
      {
        "name": "TRS|fight idle",
        "duration": 1.6666666269302368
      },
      {
        "name": "TRS|fight idle01",
        "duration": 4.666666507720947
      },
      {
        "name": "TRS|hit back",
        "duration": 0.6666666865348816
      },
      {
        "name": "TRS|hit front",
        "duration": 0.5833333134651184
      },
      {
        "name": "TRS|hit left",
        "duration": 0.5833333134651184
      },
      {
        "name": "TRS|hit right",
        "duration": 0.5833333134651184
      },
      {
        "name": "TRS|HIT2",
        "duration": 0.5833333134651184
      },
      {
        "name": "TRS|idle",
        "duration": 4.041666507720947
      },
      {
        "name": "TRS|idle down",
        "duration": 4.541666507720947
      },
      {
        "name": "TRS|idle Trumped",
        "duration": 3.2916667461395264
      },
      {
        "name": "TRS|idle trumpet",
        "duration": 1
      },
      {
        "name": "TRS|pick",
        "duration": 2.0416667461395264
      },
      {
        "name": "TRS|pick_STAND",
        "duration": 2.0416667461395264
      },
      {
        "name": "TRS|rest",
        "duration": 2.0416667461395264
      },
      {
        "name": "TRS|run",
        "duration": 0.8333333134651184
      },
      {
        "name": "TRS|run attack",
        "duration": 0.8333333134651184
      },
      {
        "name": "TRS|sit and agressive",
        "duration": 6.291666507720947
      },
      {
        "name": "TRS|sleep",
        "duration": 2.0416667461395264
      },
      {
        "name": "TRS|wakeup",
        "duration": 3.2916667461395264
      },
      {
        "name": "TRS|walk",
        "duration": 1.7916666269302368
      }
    ],
    "runtimePath": "owner-models/native/elephant.glb",
    "farPath": null,
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "Rukh3D (https://sketchfab.com/rukh3d)",
      "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
      "source": "https://sketchfab.com/3d-models/elephant-4ae161372d6a4219a87340339d1ffe03",
      "title": "Elephant"
    },
    "privateOnly": true
  },
  "eagle": {
    "key": "eagle",
    "domain": "bird",
    "originalFile": "eagle.glb",
    "originalSha256": "d185ca682ac8f938dd9ab69237cfae6c1619fd20a3e46c59ce6762e5da666d7a",
    "originalTriangles": 10828,
    "originalClips": [],
    "runtimePath": "owner-models/native/eagle.glb",
    "farPath": "owner-models/derived/eagle-far.glb",
    "requiresDerivedGeometry": false,
    "embeddedMetadata": {
      "author": "victorberdugo1 (https://sketchfab.com/victorberdugo1)",
      "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
      "source": "https://sketchfab.com/3d-models/eagle-c6f0f69f366f478cb9c2c19527f27420",
      "title": "Eagle"
    },
    "privateOnly": true
  }
});
export async function loadApprovedWildlife({key,baseUrl='./',url=null}={}){const profile=APPROVED_WILDLIFE[key];if(!profile)throw new Error('Unapproved or rejected wildlife model: '+key);const asset=await loadImportedAsset({url:url??baseUrl+profile.runtimePath,loader:createImportedMaterialLoader()});return {profile,asset};}
